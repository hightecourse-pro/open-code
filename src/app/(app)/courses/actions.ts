"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSubscriber } from "@/lib/auth";
import { queueRevokes } from "@/lib/drive-shares";
import { ensureAccess } from "@/lib/content-access";
import { COURSE_DATE_HE as DATE_HE, swapEligibleAt } from "@/lib/course-library";

function monthStart(): string {
  return new Date().toISOString().slice(0, 7) + "-01"; // YYYY-MM-01
}

/**
 * Start (or switch to) a course. Library model: one active course at a time,
 * and you may take a new one once a month (rolling, from the previous take).
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
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("courses").select("id, is_published").eq("id", courseId).maybeSingle(),
  ]);
  // The same rule the screen uses to show the button — otherwise an admin sees
  // "התחילי קורס" and gets told to buy a subscription when she clicks it.
  if (!me || !isSubscriber(me)) {
    return { error: "פתיחת קורס נפתחת עם מנוי לקהילה 💜" };
  }
  if (me.role === "mentor") {
    return { error: "ספריית הקורסים מיועדת לחברות הקהילה — למנטוריות פתוחים הסשנים וההקלטות 💜" };
  }
  if (!course?.is_published) return { error: "הקורס הזה לא זמין כרגע." };

  const { data: active } = await supabase
    .from("enrollments")
    .select("id, course_id, started_at, created_at")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  const now = new Date();

  if (active) {
    if (active.course_id === courseId) return { ok: true };
    const takenAt = active.started_at ?? active.created_at;
    const eligibleAt = swapEligibleAt(takenAt);
    if (eligibleAt > now) {
      return {
        error: `אפשר להחליף קורס פעם בחודש 💜 זכאות ההחלפה הבאה שלך: ${DATE_HE.format(eligibleAt)}.`,
      };
    }
    await supabase
      .from("enrollments")
      .update({ status: "returned", switched_at: now.toISOString() })
      .eq("id", active.id);
    // Switching away also ends access to the old course's material.
    await queueRevokes(user.id, "course", [active.course_id]);
  } else {
    // No active course — but "return then start" must not bypass the monthly
    // limit. The rolling month counts from the most recent take, whatever its
    // status now; only THAT course may be resumed early.
    const { data: latest } = await supabase
      .from("enrollments")
      .select("course_id, started_at, created_at")
      .eq("profile_id", user.id)
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (latest && latest.course_id !== courseId) {
      const eligibleAt = swapEligibleAt(latest.started_at ?? latest.created_at);
      if (eligibleAt > now) {
        return {
          error: `אפשר לקחת קורס חדש פעם בחודש 💜 זכאות ההחלפה שלך: ${DATE_HE.format(eligibleAt)}. עד אז אפשר לחזור לקורס הקודם.`,
        };
      }
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
      .update({ status: "active", last_switch_month: monthStart(), started_at: now.toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("enrollments").insert({
      profile_id: user.id,
      course_id: courseId,
      status: "active",
      last_switch_month: monthStart(),
      started_at: now.toISOString(),
    });
  }

  // Pressing "התחילי קורס" IS the access attempt — there is no reason to make
  // her press a second button. Grant it now; anything that fails leaves the
  // row pending and the worker finishes it.
  try {
    await ensureAccess(user.id, "course", courseId);
  } catch (e) {
    console.error("[drive] course access failed:", e);
  }

  revalidatePath("/courses");
  return { ok: true };
}

// `recordView` moved to src/app/(app)/content/actions.ts, where all the entry
// logging lives — courses and sessions alike.

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
  const clean = feedback.trim() || null;
  // The truth lives in course_feedback — it exists for EVERY member, admin or
  // gifted-course included; the enrollments copy (when she has a row) keeps
  // the existing analytics working unchanged.
  await supabase.from("course_feedback").upsert(
    { profile_id: user.id, course_id: courseId, rating: safe, feedback: clean, updated_at: new Date().toISOString() },
    { onConflict: "profile_id,course_id" }
  );
  await supabase
    .from("enrollments")
    .update({ rating: safe, feedback: clean })
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
