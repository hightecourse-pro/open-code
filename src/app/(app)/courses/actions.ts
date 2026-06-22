"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function monthStart(): string {
  return new Date().toISOString().slice(0, 7) + "-01"; // YYYY-MM-01
}

/**
 * Start (or switch to) a course. Library model: one active course at a time,
 * and you may switch at most once per calendar month.
 */
export async function startCourse(courseId: string): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: active } = await supabase
    .from("enrollments")
    .select("id, course_id, last_switch_month")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const thisMonth = monthStart();

  if (active) {
    if (active.course_id === courseId) return { ok: true };
    if (active.last_switch_month && active.last_switch_month >= thisMonth) {
      return { error: "אפשר להחליף קורס פעם בחודש. הקורס הנוכחי יישאר זמין עד החודש הבא 💜" };
    }
    await supabase
      .from("enrollments")
      .update({ status: "returned", switched_at: new Date().toISOString() })
      .eq("id", active.id);
  }

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("profile_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("enrollments")
      .update({ status: "active", last_switch_month: thisMonth, started_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("enrollments").insert({
      profile_id: user.id,
      course_id: courseId,
      status: "active",
      last_switch_month: thisMonth,
    });
  }

  // Queue a personal Drive share for this course (admin actions it in the queue).
  // Share rows are admin-managed under RLS, so write via the service role.
  await createAdminClient()
    .from("content_shares")
    .upsert(
      { owner_type: "course", owner_id: courseId, profile_id: user.id, status: "pending" },
      { onConflict: "owner_type,owner_id,profile_id", ignoreDuplicates: true }
    );

  revalidatePath("/courses");
  return { ok: true };
}

/** Record that a member opened/watched a course video (feeds admin analytics). */
export async function recordView(linkId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("content_views").insert({ link_id: linkId, profile_id: user.id });
}

/** Mark the active course as studied (or not). */
export async function setStudied(courseId: string, studied: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("enrollments")
    .update({ studied })
    .eq("profile_id", user.id)
    .eq("course_id", courseId);
  revalidatePath("/courses");
}

/** Save a short course feedback (1–5 rating + free text). */
export async function saveCourseFeedback(
  courseId: string,
  rating: number,
  feedback: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const safe = Math.max(1, Math.min(5, Math.round(rating))) || null;
  await supabase
    .from("enrollments")
    .update({ rating: safe, feedback: feedback.trim() || null })
    .eq("profile_id", user.id)
    .eq("course_id", courseId);
  revalidatePath("/courses");
}

export async function returnCourse(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: active } = await supabase
    .from("enrollments")
    .select("id, course_id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  await supabase
    .from("enrollments")
    .update({ status: "returned", switched_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .eq("status", "active");

  // Flag the personal Drive share for revocation (admin unshares in the queue).
  // If it was never actually shared, drop the row instead. Service role: the
  // share table is admin-managed under RLS.
  if (active) {
    const admin = createAdminClient();
    const { data: share } = await admin
      .from("content_shares")
      .select("id, status")
      .eq("owner_type", "course")
      .eq("owner_id", active.course_id)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (share?.status === "shared") {
      await admin
        .from("content_shares")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", share.id);
    } else if (share) {
      await admin.from("content_shares").delete().eq("id", share.id);
    }
  }

  revalidatePath("/courses");
}
