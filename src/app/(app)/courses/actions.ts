"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { queueRevokes, queueShares } from "@/lib/drive-shares";

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

  // Opening a course now grants real Drive access, so verify membership here
  // and not only in the page layout — a server action is directly callable.
  const [{ data: me }, { data: course }] = await Promise.all([
    supabase.from("profiles").select("status").eq("id", user.id).single(),
    supabase.from("courses").select("id, is_published").eq("id", courseId).maybeSingle(),
  ]);
  if (me?.status !== "active") return { error: "המנוי שלך לא פעיל כרגע." };
  if (!course?.is_published) return { error: "הקורס הזה לא זמין כרגע." };

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
    // Switching away also ends access to the old course's material.
    await queueRevokes(user.id, "course", [active.course_id]);
  } else {
    // No active course — but "return then start" must not bypass the monthly
    // limit. If any enrollment was already taken this month, only THAT course
    // may be resumed until next month.
    const { data: latest } = await supabase
      .from("enrollments")
      .select("course_id, last_switch_month")
      .eq("profile_id", user.id)
      .order("last_switch_month", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      latest?.last_switch_month &&
      latest.last_switch_month >= thisMonth &&
      latest.course_id !== courseId
    ) {
      return { error: "אפשר לפתוח קורס חדש פעם בחודש 💜 תוכלי לחזור לקורס שהיה לך החודש, או לחכות לחודש הבא." };
    }
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

  // Queue this course's Drive material for her (the sync worker grants it).
  try {
    await queueShares(user.id, "course", [courseId]);
  } catch (e) {
    console.error("[drive] course queue failed:", e);
  }

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

  // Returning a course also ends her access to its Drive material.
  if (active) {
    try {
      await queueRevokes(user.id, "course", [active.course_id]);
    } catch (e) {
      console.error("[drive] course revoke queue failed:", e);
    }
  }

  revalidatePath("/courses");
}
