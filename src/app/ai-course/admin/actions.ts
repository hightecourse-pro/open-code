"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TAB, saveTagsSettings, spreadsheetIdFrom, testConnection, type ConnectionReport } from "@/app/tags/server";

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

/* מערכת הדפסת תגים (27/10): the sheet, the tab and the entry code of /tags. */

export type TagsSaveResult = { ok: true } | { ok: false; error: string };
export type TagsConnectionResult = ConnectionReport;

export async function saveTagsSettingsAction(input: { sheet: string; tab: string; code: string }): Promise<TagsSaveResult> {
  const profile = await getProfile();
  if (profile?.role !== "admin") return { ok: false, error: "אין לך הרשאה לפעולה הזו." };
  const sheet = (input.sheet ?? "").trim();
  const spreadsheetId = sheet ? spreadsheetIdFrom(sheet) : null;
  if (sheet && !spreadsheetId) return { ok: false, error: "זה לא נראה כמו קישור לגיליון גוגל - הדביקי את הכתובת מהדפדפן." };
  const code = (input.code ?? "").trim();
  if (code && code.length < 4) return { ok: false, error: "קוד הכניסה צריך להיות באורך 4 תווים לפחות." };
  const tab = (input.tab ?? "").trim() || DEFAULT_TAB;
  try {
    await saveTagsSettings({ spreadsheetId, tab, code: code || null });
  } catch {
    return { ok: false, error: "השמירה נכשלה - נסי שוב." };
  }
  revalidatePath("/ai-course/admin");
  revalidatePath("/tags");
  return { ok: true };
}

export async function testTagsConnectionAction(): Promise<TagsConnectionResult> {
  const profile = await getProfile();
  if (profile?.role !== "admin") return { ok: false, error: "אין לך הרשאה לפעולה הזו.", hint: "forbidden" };
  // tests the SAVED settings, not the form - "save, then test" is the order the card asks for
  return testConnection();
}
