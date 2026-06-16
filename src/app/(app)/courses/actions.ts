"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  revalidatePath("/courses");
  return { ok: true };
}

export async function returnCourse(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("enrollments")
    .update({ status: "returned", switched_at: new Date().toISOString() })
    .eq("profile_id", user.id)
    .eq("status", "active");

  revalidatePath("/courses");
}
