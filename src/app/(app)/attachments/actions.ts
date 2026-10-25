"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile } from "@/lib/auth";
import { netfreeSafeUrl } from "@/lib/netfree";
import {
  FILE_MIMES,
  IMAGE_MIMES,
  MAX_FILE_BYTES,
  MAX_IMAGE_BYTES,
  TEXT_EXTENSIONS,
  TEXT_MIME,
} from "@/lib/attachments";

export interface UploadedAttachment {
  id: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  isImage: boolean;
  /** For the composer's own preview only - short-lived. */
  previewUrl: string | null;
}

/**
 * One file from a composer → the private bucket + an UNLINKED metadata row.
 * The send action stamps the context; the nightly sweep clears abandoned ones.
 * Validation runs here regardless of what the UI allowed - a server action is
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
  // An AutoHotkey script (.ahk, the owner 25/10) arrives with an empty or generic type - it is plain text.
  const extOf = /\.[A-Za-z0-9]{1,8}$/.exec(file.name)?.[0].toLowerCase() ?? "";
  const isTextScript = TEXT_EXTENSIONS.includes(extOf) && (!file.type || /^(text\/plain|application\/octet-stream|application\/x-autohotkey)$/i.test(file.type));
  const mime = isTextScript ? TEXT_MIME : file.type;
  if (!FILE_MIMES.includes(mime)) {
    return { ok: false, error: "אפשר לצרף תמונות (PNG/JPG/WebP/GIF), PDF, Word או סקריפט AHK." };
  }
  const isImage = IMAGE_MIMES.includes(mime);
  const cap = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
  if (file.size > cap) {
    return { ok: false, error: `הקובץ גדול מדי - עד ${isImage ? "5MB לתמונה" : "10MB לקובץ"}.` };
  }

  // Her own folder, an unguessable name, the original name kept for display.
  // The storage KEY must stay ASCII - Supabase rejects Hebrew letters in
  // object keys, which is exactly how "צילום מסך….png" failed while a pasted
  // "image.png" sailed through (the owner + a member, 8/9). Only the key is
  // neutral; the Hebrew name lives on in the attachments row.
  const safeName = file.name.replace(/[^\p{L}\p{N}.\-_ ]/gu, "").slice(-80) || "קובץ";
  const ext = /\.[A-Za-z0-9]{1,8}$/.exec(file.name)?.[0].toLowerCase() ?? "";
  const path = `${profile.id}/${crypto.randomUUID()}${ext}`;

  const supabase = await createClient();
  // storage-js sends a Blob as multipart and takes the part's type from the Blob itself, ignoring `contentType` -
  // a script arriving as application/octet-stream must be re-wrapped as text/plain or the bucket refuses it.
  const body = mime === file.type ? file : new Blob([await file.arrayBuffer()], { type: mime });
  const { error: upErr } = await supabase.storage
    .from("attachments")
    .upload(path, body, { contentType: mime });
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
      mime,
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
      mime,
      sizeBytes: file.size,
      isImage,
      previewUrl: netfreeSafeUrl(signed?.signedUrl ?? null),
    },
  };
}

/** Composing and changed her mind - remove an UNLINKED file of hers. */
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
