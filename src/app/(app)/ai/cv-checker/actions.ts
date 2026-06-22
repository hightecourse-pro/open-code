"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withUserKey, type AiReason } from "@/lib/ai/keys";
import { analyzeCvPdf, type CvAnalysis } from "@/lib/ai/cv";
import type { Json } from "@/types/database";

export type CvState = { error?: string; reason?: AiReason; analysis?: CvAnalysis };

const REASON_MSG: Record<AiReason, string> = {
  no_key: "כדי להשתמש בכלי ה-AI צריך מפתח Google. אפשר להוסיף אותו בעמוד מפתחות ה-AI.",
  exhausted: "המפתח הנוכחי הגיע למכסת השימוש. הוסיפי מפתח נוסף ונמשיך 💜",
  invalid: "המפתח לא תקין יותר. בדקי אותו או הוסיפי מפתח חדש.",
  error: "משהו השתבש בניתוח. בואי ננסה שוב עוד רגע.",
};

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function runCvCheck(_prev: CvState, formData: FormData): Promise<CvState> {
  const file = formData.get("cv_file");
  const jobDescription = String(formData.get("job") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { error: "צריך להעלות קובץ PDF של קורות החיים." };
  }
  if (file.type !== "application/pdf") {
    return { error: "הקובץ צריך להיות בפורמט PDF." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "הקובץ גדול מדי — עד 10MB." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const result = await withUserKey((apiKey) =>
    analyzeCvPdf(apiKey, base64, jobDescription || undefined)
  );
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
    cv_text: null,
  });

  return { analysis };
}
