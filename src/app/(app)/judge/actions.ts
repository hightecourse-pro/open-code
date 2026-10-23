"use server";

import { revalidatePath } from "next/cache";
import { requireCommunityAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { judgeAccessFor } from "@/lib/judging";
import { CRITERIA, ZERO_SCORES, type CriterionKey } from "@/lib/judging-shared";

export interface ScoreState {
  ok?: boolean;
  error?: string;
  info?: string;
}

/** One judge's scores for one team - seven numbers within the rubric and a line per criterion. */
export async function saveScore(teamKey: string, _prev: ScoreState, formData: FormData): Promise<ScoreState> {
  const me = await requireCommunityAccess();
  const access = await judgeAccessFor(me);
  if (!access.judge) return { error: "השיפוט פתוח לשופטות שהצוות מינה." };
  const admin = createAdminClient();
  const { data: sub } = await admin.from("hackathon_submissions").select("team_key, submitted_at, challenge_key").eq("team_key", teamKey).maybeSingle();
  if (!sub?.submitted_at) return { error: "ההגשה הזו עוד לא הוגשה." };
  if (access.restricted && access.challengeKeys.length > 0 && !access.challengeKeys.includes(sub.challenge_key)) return { error: "ההגשה הזו לא באתגר שמונית אליו." };
  const values: Record<CriterionKey, number> = { ...ZERO_SCORES };
  const notes: Partial<Record<CriterionKey, string>> = {};
  for (const c of CRITERIA) {
    const n = Number(formData.get(c.key));
    if (!Number.isInteger(n) || n < 0 || n > c.max) return { error: `״${c.label}״: מספר שלם בין 0 ל-${c.max}.` };
    values[c.key] = n;
    const note = String(formData.get(`note_${c.key}`) ?? "").trim().slice(0, 600);
    if (note) notes[c.key] = note;
  }
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 2000) || null;
  const { error } = await admin.from("hackathon_scores").upsert({ team_key: teamKey, judge_id: me.id, ...values, notes, comment }, { onConflict: "team_key,judge_id" });
  if (error) return { error: "השמירה נכשלה. נסי שוב." };
  revalidatePath("/judge");
  revalidatePath("/admin/hackathon");
  return { ok: true, info: "הציון נשמר ✓" };
}
