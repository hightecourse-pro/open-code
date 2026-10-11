import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/ai/crypto";

/**
 * The second kind of course (the owner, 11/10): recordings hosted on another
 * site behind a shared username + password, shown to a member only while the
 * course is hers (active take or opened personally by the team), with a
 * prominent "do not pass this on" notice. Nothing is shared in Drive for it.
 */
export type CourseAccessKind = "drive" | "external";

export interface ExternalAccessRow {
  id: string;
  label: string;
  url: string;
  username: string | null;
  password: string | null;
}

export interface ExternalAccessInput {
  label: string;
  url: string;
  username: string;
  password: string;
}

/** The rows of one course, passwords decrypted - call only for an entitled viewer (or the admin). */
export async function loadExternalAccess(courseId: string): Promise<ExternalAccessRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("course_external_access")
    .select("id, label, url, username, password_enc")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((r) => {
    let password: string | null = null;
    if (r.password_enc) {
      try {
        password = decryptSecret(r.password_enc);
      } catch {
        password = null; // a secret rotation would land here - the admin re-enters it
      }
    }
    return { id: r.id, label: r.label, url: r.url, username: r.username, password };
  });
}

/** Replace the course's rows (admin). Passwords are encrypted before they touch the database. */
export async function saveExternalAccess(courseId: string, rows: ExternalAccessInput[]): Promise<void> {
  const admin = createAdminClient();
  await admin.from("course_external_access").delete().eq("course_id", courseId);
  if (rows.length === 0) return;
  const { error } = await admin.from("course_external_access").insert(
    rows.map((r, i) => ({
      course_id: courseId,
      label: r.label.trim(),
      url: r.url.trim(),
      username: r.username.trim() || null,
      password_enc: r.password.trim() ? encryptSecret(r.password.trim()) : null,
      sort_order: i,
    }))
  );
  if (error) throw error;
}

export async function setCourseAccessKind(courseId: string, kind: CourseAccessKind): Promise<void> {
  const { error } = await createAdminClient().from("courses").update({ access_kind: kind }).eq("id", courseId);
  if (error) throw error;
}
