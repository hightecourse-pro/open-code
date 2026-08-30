"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import {
  processShareQueue,
  requeueOwnerForSharedMembers,
  syncSessionAudience,
} from "@/lib/drive-shares";
import type { ContentOwner, LinkKind, ShareStatus } from "@/types/database";

/** Create a course (published immediately; links added separately). */
export async function createCourse(formData: FormData): Promise<void> {
  await requireRole("admin");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const lessons = Number(formData.get("lessons_count"));
  const hours = Number(formData.get("duration_hours"));
  const supabase = await createClient();
  await supabase.from("courses").insert({
    title,
    category: String(formData.get("category") ?? "").trim() || null,
    instructor: String(formData.get("instructor") ?? "").trim() || null,
    lessons_count: Number.isFinite(lessons) && lessons > 0 ? Math.round(lessons) : 0,
    duration_hours: Number.isFinite(hours) && hours > 0 ? Math.round(hours) : 0,
    is_published: true,
  });
  revalidatePath("/admin/content");
  revalidatePath("/courses");
}

/** Create a session (for hosting its recording links). */
export async function createSessionContent(formData: FormData): Promise<void> {
  await requireRole("admin");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = await createClient();
  // Nothing is shared here on purpose: a new session creates zero share rows.
  // The members entitled to it open it themselves from /recordings, and that
  // is what creates the row — so what we later revoke is what she really used.
  await supabase.from("sessions").insert({
    title,
    topic: String(formData.get("topic") ?? "").trim() || null,
    scheduled_at: new Date().toISOString(),
    is_published: true,
  });

  revalidatePath("/admin/content");
  revalidatePath("/admin/shares");
  revalidatePath("/events");
}

export async function deleteCourse(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("courses").delete().eq("id", id);
  revalidatePath("/admin/content");
  revalidatePath("/courses");
}

// ------------------------------------------------------------ course units
// A unit (קוביה) is one year-cycle of a course: its own name, year and links.

/** A sane year, or null. Keeps a typo out of the members' course page. */
function parseYear(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? "").trim());
  return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
}

export async function createCourseUnit(courseId: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  const { data: max } = await supabase
    .from("course_units")
    .select("sort_order")
    .eq("course_id", courseId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("course_units").insert({
    course_id: courseId,
    name,
    year: parseYear(formData.get("year")),
    sort_order: (max?.sort_order ?? 0) + 1,
  });
  revalidatePath("/admin/content");
  revalidatePath("/courses");
}

export async function updateCourseUnit(id: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  await supabase
    .from("course_units")
    .update({ name, year: parseYear(formData.get("year")) })
    .eq("id", id);
  revalidatePath("/admin/content");
  revalidatePath("/courses");
}

/** Delete a unit. Its links go with it (FK cascade) — the form warns about that. */
export async function deleteCourseUnit(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("course_units").delete().eq("id", id);
  revalidatePath("/admin/content");
  revalidatePath("/courses");
}

/**
 * Open a session's recording to the whole community, or close it back to
 * paying members, mentors and the team. The share queue follows the decision
 * both ways — opening grants the free tier, closing takes it back.
 */
export async function setSessionOpenToAll(id: string, open: boolean): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").update({ open_to_all: open }).eq("id", id);
  if (error) {
    console.error("[content] open_to_all update failed:", error.message);
    return;
  }
  try {
    await syncSessionAudience(id, open);
  } catch (e) {
    console.error("[drive] session audience sync failed:", e);
  }
  revalidatePath("/admin/content");
  revalidatePath("/admin/shares");
  revalidatePath("/recordings");
}

const SESSION_FILE_MAX = 10 * 1024 * 1024;

/** Upload a session handout to the public session-files bucket → its URL. */
async function hostSessionFile(sessionId: string, file: File, tag: string): Promise<string | null> {
  if (file.size === 0 || file.size > SESSION_FILE_MAX) return null;
  const admin = createAdminClient();
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${sessionId}/${tag}-${Date.now()}-${safe}`;
  const { error } = await admin.storage
    .from("session-files")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) {
    console.error("[sessions] file upload failed:", error.message);
    return null;
  }
  return admin.storage.from("session-files").getPublicUrl(path).data?.publicUrl ?? null;
}

/**
 * The session's learning material (the owner, 2026-08-30): the syllabus is an
 * UPLOADED file (not a link); materials take a link or an upload (the upload
 * wins); pre_topics is what to know BEFORE the session. Clearing removes the
 * button on the events screen; the syllabus stays visible after a recording.
 */
export async function updateSessionFiles(id: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();

  const patch: { pre_topics: string | null; syllabus_url?: string | null; materials_url?: string | null } = {
    pre_topics: String(formData.get("pre_topics") ?? "").trim().slice(0, 2000) || null,
  };

  const syllabusFile = formData.get("syllabus_file");
  if (formData.get("clear_syllabus") === "1") patch.syllabus_url = null;
  else if (syllabusFile instanceof File && syllabusFile.size > 0) {
    const url = await hostSessionFile(id, syllabusFile, "syllabus");
    if (url) patch.syllabus_url = url;
  }

  const materialsFile = formData.get("materials_file");
  if (materialsFile instanceof File && materialsFile.size > 0) {
    const url = await hostSessionFile(id, materialsFile, "materials");
    if (url) patch.materials_url = url;
  } else {
    patch.materials_url = String(formData.get("materials_url") ?? "").trim() || null;
  }

  await supabase.from("sessions").update(patch).eq("id", id);
  revalidatePath("/admin/content");
  revalidatePath("/admin/sessions");
  revalidatePath("/events");
}

/**
 * Add ONE materials item to a session as a content_links row — either an
 * uploaded file (hosted in session-files) or a pasted link, each with an
 * optional הסבר that becomes its title (the owner, 30/8: "רשימה של קישורים
 * וקבצים... אופציונלי להוסיף הסבר").
 */
export async function addSessionMaterial(id: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const note = String(formData.get("note") ?? "").trim().slice(0, 120);
  const file = formData.get("file");
  let url = String(formData.get("url") ?? "").trim();
  let fallbackTitle = "חומרים";
  if (file instanceof File && file.size > 0) {
    const hosted = await hostSessionFile(id, file, "materials");
    if (!hosted) return;
    url = hosted;
    fallbackTitle = file.name;
  }
  if (!url) return;
  const supabase = await createClient();
  const { data: max } = await supabase
    .from("content_links")
    .select("sort_order")
    .eq("owner_type", "session")
    .eq("owner_id", id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("content_links").insert({
    owner_type: "session",
    owner_id: id,
    kind: "materials",
    title: note || fallbackTitle,
    url,
    sort_order: (max?.sort_order ?? 0) + 1,
  });
  revalidatePath("/admin/sessions");
  revalidatePath("/recordings");
  revalidatePath("/events");
}

/**
 * The one-field recording shortcut on the session row (the owner: "בעדכון
 * סשן אני לא רואה עדכון של הקישור להקלטה") — maintains the session's FIRST
 * video content_link: set → update/insert, empty → remove.
 */
export async function setSessionRecording(id: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const url = String(formData.get("recording_url") ?? "").trim();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("content_links")
    .select("id")
    .eq("owner_type", "session")
    .eq("owner_id", id)
    .eq("kind", "video")
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!url) {
    if (existing) await supabase.from("content_links").delete().eq("id", existing.id);
  } else if (existing) {
    await supabase.from("content_links").update({ url }).eq("id", existing.id);
  } else {
    await supabase.from("content_links").insert({
      owner_type: "session",
      owner_id: id,
      kind: "video",
      title: "הקלטת הסשן",
      url,
      sort_order: 0,
    });
  }
  revalidatePath("/admin/sessions");
  revalidatePath("/admin/content");
  revalidatePath("/recordings");
}

export async function deleteSessionContent(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("sessions").delete().eq("id", id);
  revalidatePath("/admin/content");
  revalidatePath("/events");
}

/**
 * Add a Drive link (video or materials folder) to a course/session. When the
 * course is split into units, the link belongs to one of them — sharing still
 * happens per course, so the Drive queue behaves identically either way.
 */
export async function addContentLink(
  ownerType: ContentOwner,
  ownerId: string,
  unitId: string | null,
  formData: FormData
): Promise<void> {
  await requireRole("admin");
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const kind: LinkKind = String(formData.get("kind") ?? "video") === "materials" ? "materials" : "video";
  if (!title || !url) return;
  const supabase = await createClient();
  const { data: max } = await supabase
    .from("content_links")
    .select("sort_order")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  await supabase.from("content_links").insert({
    owner_type: ownerType,
    owner_id: ownerId,
    unit_id: unitId,
    kind,
    title,
    url,
    sort_order: (max?.sort_order ?? 0) + 1,
  });

  // Material added after the fact still reaches everyone it belongs to: the
  // already-shared rows go back to pending so the worker grants the new link.
  try {
    await requeueOwnerForSharedMembers(ownerType, ownerId);
  } catch (e) {
    console.error("[drive] link requeue failed:", e);
  }

  revalidatePath("/admin/content");
  revalidatePath("/admin/shares");
  revalidatePath("/courses");
}

export async function deleteContentLink(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("content_links").delete().eq("id", id);
  revalidatePath("/admin/content");
  revalidatePath("/courses");
  // The sessions manager hosts the same delete (session materials panel) —
  // without this the row survived on screen and read as "אין אפשרות למחוק".
  revalidatePath("/admin/sessions");
}

/** Delete a checked subset of a course/session's links in one motion. */
export async function bulkDeleteContentLinks(ids: string[]): Promise<void> {
  await requireRole("admin");
  const clean = [...new Set(ids.filter(Boolean))].slice(0, 200);
  if (clean.length === 0) return;
  const supabase = await createClient();
  await supabase.from("content_links").delete().in("id", clean);
  revalidatePath("/admin/content");
  revalidatePath("/courses");
  revalidatePath("/admin/sessions");
}

/** Bulk-mark pending shares as done — all of them or a checked subset. */
export async function markSharesShared(ids: string[]): Promise<void> {
  await requireRole("admin");
  const clean = [...new Set(ids.filter(Boolean))].slice(0, 500);
  if (clean.length === 0) return;
  const supabase = await createClient();
  await supabase
    .from("content_shares")
    .update({ status: "shared", shared_at: new Date().toISOString() })
    .in("id", clean);
  revalidatePath("/admin/shares");
}

/** Mark a personal Drive share as actioned (shared / revoked) in the queue. */
export async function markShareStatus(id: string, status: Exclude<ShareStatus, "pending">): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  const patch =
    status === "shared"
      ? { status, shared_at: new Date().toISOString() }
      : { status, revoked_at: new Date().toISOString() };
  await supabase.from("content_shares").update(patch).eq("id", id);
  revalidatePath("/admin/shares");
}

/** Run the Drive sync now instead of waiting for the scheduled run. */
export async function syncDriveNow(): Promise<void> {
  await requireRole("admin");
  try {
    const result = await processShareQueue(60);
    console.log("[drive] manual sync:", result);
  } catch (e) {
    console.error("[drive] manual sync failed:", e);
  }
  revalidatePath("/admin/shares");
}

/** Remove a share queue row entirely (e.g. a revoked one that's been handled). */
export async function dismissShare(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("content_shares").delete().eq("id", id);
  revalidatePath("/admin/shares");
}
