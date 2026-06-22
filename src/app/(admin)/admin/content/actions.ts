"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { ContentOwner, LinkKind, ShareStatus } from "@/types/database";

/** Create a course (published immediately; links added separately). */
export async function createCourse(formData: FormData): Promise<void> {
  await requireRole("admin");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const supabase = await createClient();
  await supabase.from("courses").insert({
    title,
    category: String(formData.get("category") ?? "").trim() || null,
    instructor: String(formData.get("instructor") ?? "").trim() || null,
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
  await supabase.from("sessions").insert({
    title,
    topic: String(formData.get("topic") ?? "").trim() || null,
    scheduled_at: new Date().toISOString(),
    is_published: true,
  });
  revalidatePath("/admin/content");
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
  revalidatePath("/admin/content");
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

/** Remove a share queue row entirely (e.g. a revoked one that's been handled). */
export async function dismissShare(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("content_shares").delete().eq("id", id);
  revalidatePath("/admin/shares");
}
