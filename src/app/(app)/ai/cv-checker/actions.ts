"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withUserKey, type AiReason } from "@/lib/ai/keys";
import { analyzeCv, type CvAnalysis } from "@/lib/ai/cv";
import type { Json } from "@/types/database";

export type CvState = { error?: string; reason?: AiReason; analysis?: CvAnalysis };

const REASON_MSG: Record<AiReason, string> = {
  no_key: "כדי להשתמש בכלי ה-AI צריך מפתח Google. אפשר להוסיף אותו בעמוד מפתחות ה-AI.",
  exhausted: "המפתח הנוכחי הגיע למכסת השימוש. הוסיפי מפתח נוסף ונמשיך 💜",
  invalid: "המפתח לא תקין יותר. בדקי אותו או הוסיפי מפתח חדש.",
  error: "משהו השתבש בניתוח. בואי ננסה שוב עוד רגע.",
};

export async function runCvCheck(_prev: CvState, formData: FormData): Promise<CvState> {
  const cvText = String(formData.get("cv") ?? "").trim();
  const jobDescription = String(formData.get("job") ?? "").trim();

  if (cvText.length < 80) {
    return { error: "הדביקי טקסט מלא של קורות החיים (לפחות כמה שורות) ונבדוק אותו יחד." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await withUserKey((apiKey) => analyzeCv(apiKey, cvText, jobDescription || undefined));
  if (!result.ok) {
    return { reason: result.reason, error: REASON_MSG[result.reason] };
  }

  const analysis = result.data;
  await supabase.from("cv_reviews").insert({
    profile_id: user.id,
    source: "ai",
    score: analysis.score,
    summary: analysis.summary,
    insights: analysis.insights as unknown as Json,
    job_fit: (analysis.job_fit ?? null) as unknown as Json,
    cv_text: cvText.slice(0, 8000),
  });

  return { analysis };
}
