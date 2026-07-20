"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  processShareQueue,
  queueSessionForAllMembers,
  requeueOwnerForSharedMembers,
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
  const { data: created } = await supabase
    .from("sessions")
    .insert({
      title,
      topic: String(formData.get("topic") ?? "").trim() || null,
      scheduled_at: new Date().toISOString(),
      is_published: true,
    })
    .select("id")
    .single();

  // Every existing member gets the new session too — not just future joiners.
  if (created) {
    try {
      await queueSessionForAllMembers(created.id);
    } catch (e) {
      console.error("[drive] new session queue failed:", e);
    }
  }

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

export async function deleteSessionContent(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("sessions").delete().eq("id", id);
  revalidatePath("/admin/content");
  revalidatePath("/events");
}

/** Add a Drive link (video or materials folder) to a course/session. */
export async function addContentLink(
  ownerType: ContentOwner,
  ownerId: string,
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
