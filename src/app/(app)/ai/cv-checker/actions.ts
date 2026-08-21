"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, isSubscriber } from "@/lib/auth";
import { withUserKey, type AiReason } from "@/lib/ai/keys";
import { analyzeCvPdf, type CvAnalysis } from "@/lib/ai/cv";
import type { Json } from "@/types/database";

export type CvState = { error?: string; reason?: AiReason; analysis?: CvAnalysis };

const REASON_MSG: Record<AiReason, string> = {
  no_key: "כדי להשתמש בכלי ה-AI תצטרכי מפתח Google — תוכלי להוסיף אותו בעמוד מפתחות ה-AI.",
  exhausted: "המפתח הנוכחי הגיע למכסת השימוש. הוסיפי מפתח נוסף ונמשיך 💜",
  invalid: "המפתח לא תקין יותר. בדקי אותו או הוסיפי מפתח חדש.",
  error: "משהו השתבש בניתוח. בואי ננסה שוב עוד רגע.",
};

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function runCvCheck(_prev: CvState, formData: FormData): Promise<CvState> {
  const me = await getProfile();
  if (!me || !isSubscriber(me)) {
    return { error: "כלי ה-AI נפתחים עם מנוי לקהילה 💜" };
  }

  const file = formData.get("cv_file");
  const docId = String(formData.get("cv_doc_id") ?? "").trim();
  const jobDescription = String(formData.get("job") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let base64: string;
  if (docId) {
    // A CV she already keeps with us — fetched with HER client, so RLS is what
    // proves the document is hers before the service role touches storage.
    const { data: doc } = await supabase
      .from("cv_documents")
      .select("id, file_path, file_name")
      .eq("id", docId)
      .maybeSingle();
    if (!doc) {
      return { error: "לא מצאנו את קורות החיים ששמורות אצלנו — נסי לבחור שוב או להעלות קובץ." };
    }
    if (!/\.pdf$/i.test(doc.file_name ?? "")) {
      return { error: "הבדיקה עובדת על PDF — הקובץ השמור הזה הוא Word. העלי גרסת PDF." };
    }
    const admin = createAdminClient();
    const { data: blob, error: dlErr } = await admin.storage.from("cvs").download(doc.file_path);
    if (dlErr || !blob) {
      return { error: "לא הצלחנו לפתוח את הקובץ השמור. נסי להעלות אותו ישירות." };
    }
    if (blob.size > MAX_BYTES) {
      return { error: "הקובץ גדול מדי — עד 10MB." };
    }
    base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
  } else {
    if (!(file instanceof File) || file.size === 0) {
      return { error: "כדי שנתחיל, העלי קובץ PDF של קורות החיים." };
    }
    if (file.type !== "application/pdf") {
      return { error: "הקובץ צריך להיות בפורמט PDF." };
    }
    if (file.size > MAX_BYTES) {
      return { error: "הקובץ גדול מדי — עד 10MB." };
    }
    base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  }

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
