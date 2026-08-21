"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import {
  FILE_MIMES,
  IMAGE_MIMES,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
} from "@/lib/attachments";

export interface UploadedAttachment {
  id: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  isImage: boolean;
  /** For the composer's own preview only — short-lived. */
  previewUrl: string | null;
}

/**
 * One file from a composer → the private bucket + an UNLINKED metadata row.
 * The send action stamps the context; the nightly sweep clears abandoned ones.
 * Validation runs here regardless of what the UI allowed — a server action is
 * an endpoint anyone can call.
 */
export async function uploadAttachment(
  formData: FormData
): Promise<{ ok: true; attachment: UploadedAttachment } | { ok: false; error: string }> {
  const profile = await getProfile();
  if (!profile || profile.status !== "active") {
    return { ok: false, error: "צריך להיות מחוברת ופעילה כדי לצרף קבצים." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "לא הגיע קובץ." };
  }
  if (!FILE_MIMES.includes(file.type)) {
    return { ok: false, error: "אפשר לצרף תמונות (PNG/JPG/WebP/GIF), PDF או Word." };
  }
  const isImage = IMAGE_MIMES.includes(file.type);
  const cap = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (file.size > cap) {
    return { ok: false, error: `הקובץ גדול מדי — עד ${isImage ? "5MB לתמונה" : "10MB לקובץ"}.` };
  }

  // Her own folder, an unguessable name, the original name kept for display.
  const safeName = file.name.replace(/[^\p{L}\p{N}.\-_ ]/gu, "").slice(-80) || "קובץ";
  const path = `${profile.id}/${crypto.randomUUID()}-${safeName}`;

  const supabase = await createClient();
  const { error: upErr } = await supabase.storage
    .from("attachments")
    .upload(path, file, { contentType: file.type });
  if (upErr) {
    console.error("[attachments] upload failed:", upErr.message);
    return { ok: false, error: "ההעלאה נכשלה. נסי שוב." };
  }

  const { data: row, error: rowErr } = await supabase
    .from("attachments")
    .insert({
      profile_id: profile.id,
      file_path: path,
      file_name: safeName,
      mime: file.type,
      size_bytes: file.size,
    })
    .select("id")
    .single();
  if (rowErr || !row) {
    await supabase.storage.from("attachments").remove([path]);
    return { ok: false, error: "ההעלאה נכשלה. נסי שוב." };
  }

  const { data: signed } = await createAdminClient()
    .storage.from("attachments")
    .createSignedUrl(path, 600);

  return {
    ok: true,
    attachment: {
      id: row.id,
      fileName: safeName,
      mime: file.type,
      sizeBytes: file.size,
      isImage,
      previewUrl: signed?.signedUrl ?? null,
    },
  };
}

/** Composing and changed her mind — remove an UNLINKED file of hers. */
export async function removeUnlinkedAttachment(id: string): Promise<void> {
  const profile = await getProfile();
  if (!profile) return;
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("attachments")
    .select("id, file_path")
    .eq("id", id)
    .eq("profile_id", profile.id)
    .is("context_id", null)
    .maybeSingle();
  if (!row) return;
  await admin.storage.from("attachments").remove([row.file_path]);
  await admin.from("attachments").delete().eq("id", row.id);
}
