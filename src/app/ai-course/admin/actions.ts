"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/* Admin-only maintenance of the quiz rows (the Hightecourse admin screen). */

export type DeleteResult = { ok: true } | { ok: false; error: string };

/** Remove a row - a test entry, a typo, a duplicate she asked to forget. */
export async function deleteSubmission(id: string): Promise<DeleteResult> {
  const profile = await getProfile();
  if (profile?.role !== "admin") return { ok: false, error: "אין לך הרשאה לפעולה הזו." };
  if (!id) return { ok: false, error: "לא נמצאה שורה למחיקה." };
  const admin = createAdminClient();
  const { error } = await admin.from("ai_course_quiz_submissions").delete().eq("id", id);
  if (error) return { ok: false, error: "המחיקה נכשלה - נסי שוב." };
  revalidatePath("/ai-course/admin");
  return { ok: true };
}
