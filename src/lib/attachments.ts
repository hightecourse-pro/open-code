import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** What a screen needs to show one attachment. URLs are signed and expire. */
export interface AttachmentView {
  id: string;
  fileName: string;
  mime: string;
  sizeBytes: number;
  url: string;
  isImage: boolean;
}

export const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const FILE_MIMES = [
  ...IMAGE_MIMES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Signed-URL lifetime — long enough to read a thread, short enough to expire. */
const SIGN_TTL_SECONDS = 60 * 60;

/**
 * Everything attached to a batch of posts/comments/messages, keyed by
 * context id, each with a fresh signed URL. Service-role: the CALLER is
 * responsible for only asking about content the viewer is allowed to see —
 * every screen that calls this already fetched those parents under RLS.
 */
export async function attachmentsFor(
  context: "post" | "comment" | "message" | "request",
  contextIds: string[]
): Promise<Map<string, AttachmentView[]>> {
  const out = new Map<string, AttachmentView[]>();
  if (contextIds.length === 0) return out;

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("attachments")
    .select("id, context_id, file_path, file_name, mime, size_bytes")
    .eq("context", context)
    .in("context_id", contextIds)
    .order("created_at", { ascending: true });
  if (!rows?.length) return out;

  const { data: signed } = await admin.storage
    .from("attachments")
    .createSignedUrls(rows.map((r) => r.file_path), SIGN_TTL_SECONDS);
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  for (const r of rows) {
    const url = urlOf.get(r.file_path);
    if (!url || !r.context_id) continue;
    const list = out.get(r.context_id) ?? [];
    list.push({
      id: r.id,
      fileName: r.file_name,
      mime: r.mime,
      sizeBytes: r.size_bytes,
      url,
      isImage: IMAGE_MIMES.includes(r.mime),
    });
    out.set(r.context_id, list);
  }
  return out;
}

/**
 * Stamp freshly-sent content onto the uploader's unlinked attachment rows.
 * Only HER unlinked rows can be claimed — an id belonging to someone else, or
 * already linked elsewhere, is silently skipped.
 */
export async function linkAttachments(
  profileId: string,
  context: "post" | "comment" | "message" | "request",
  contextId: string,
  attachmentIds: string[]
): Promise<void> {
  if (attachmentIds.length === 0) return;
  const admin = createAdminClient();
  await admin
    .from("attachments")
    .update({ context, context_id: contextId })
    .in("id", attachmentIds.slice(0, 10))
    .eq("profile_id", profileId)
    .is("context_id", null);
}

/** The ids a composer put in its hidden inputs. */
export function attachmentIdsFrom(formData: FormData): string[] {
  return formData
    .getAll("attach_ids")
    .map(String)
    .filter((v) => /^[0-9a-f-]{36}$/.test(v))
    .slice(0, 10);
}
