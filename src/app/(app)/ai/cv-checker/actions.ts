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
  // Telemetry wrapper (2/9): 17 members with valid keys got no result and no
  // recorded reason — every run now logs its outcome so support has a row.
  const startedAt = Date.now();
  const state = await runCvCheckInner(formData);
  try {
    const admin = createAdminClient();
    const supa = await createClient();
    const { data: { user } } = await supa.auth.getUser();
    await admin.from("ai_tool_runs").insert({
      tool: "cv_check",
      profile_id: user?.id ?? null,
      ok: !state.error,
      error: state.error ? `${state.reason ? state.reason + ": " : ""}${state.error}`.slice(0, 300) : null,
      meta: { ms: Date.now() - startedAt } as unknown as Json,
    });
  } catch {
    /* never let telemetry break the tool */
  }
  return state;
}

/**
 * Recovery poll: filtered networks (2/9, שפרה למברגר) cut the long analysis
 * request around a minute with a 504 — while the server finishes and saves the
 * review. The client then polls here for a review newer than the newest one it
 * rendered, and shows the saved result instead of an error. Server timestamps
 * on both sides, so a skewed client clock can't miss it.
 */
export async function latestCvReviewSince(afterIso: string | null): Promise<CvState | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let q = supabase
    .from("cv_reviews")
    .select("score, summary, insights, job_fit, created_at")
    .eq("profile_id", user.id)
    .eq("source", "ai")
    .order("created_at", { ascending: false })
    .limit(1);
  // No history yet → any review is this run's; still window it so a stale
  // row can never masquerade as a fresh result.
  q = q.gt("created_at", afterIso ?? new Date(Date.now() - 15 * 60_000).toISOString());
  const { data: row } = await q.maybeSingle();
  if (!row || typeof row.score !== "number") return null;

  const analysis: CvAnalysis = {
    score: row.score,
    summary: row.summary ?? "",
    insights: Array.isArray(row.insights) ? (row.insights as unknown as CvAnalysis["insights"]) : [],
    job_fit: (row.job_fit ?? null) as CvAnalysis["job_fit"],
  };
  return { analysis };
}

async function runCvCheckInner(formData: FormData): Promise<CvState> {
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
  let uploadBuffer: Buffer | null = null;
  if (docId) {
    // A CV she already keeps with us. profile_id is checked explicitly, not
    // left to RLS — an admin's RLS reads every document, and the service role
    // is about to touch storage on the strength of this row being hers.
    const { data: doc } = await supabase
      .from("cv_documents")
      .select("id, file_path, file_name")
      .eq("id", docId)
      .eq("profile_id", user.id)
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
    uploadBuffer = Buffer.from(await file.arrayBuffer());
    base64 = uploadBuffer.toString("base64");
  }

  const result = await withUserKey((apiKey) =>
    analyzeCvPdf(apiKey, base64, jobDescription || undefined)
  );
  if (!result.ok) {
    return { reason: result.reason, error: REASON_MSG[result.reason] };
  }

  const analysis = result.data;

  // A one-off upload is kept as a snapshot so the history can open the exact
  // file the feedback talks about (the owner, 30/8). Under her own folder in
  // the cvs bucket — the member storage policy signs it without a new route.
  // Best effort: a storage hiccup must not cost her the analysis she paid
  // tokens for.
  let checkedFilePath: string | null = null;
  if (uploadBuffer) {
    const path = `${user.id}/ai-checks/${Date.now()}.pdf`;
    const { error: upErr } = await createAdminClient()
      .storage.from("cvs")
      .upload(path, uploadBuffer, { contentType: "application/pdf" });
    if (!upErr) checkedFilePath = path;
  }

  await supabase.from("cv_reviews").insert({
    profile_id: user.id,
    source: "ai",
    score: analysis.score,
    summary: analysis.summary,
    insights: analysis.insights as unknown as Json,
    job_fit: (analysis.job_fit ?? null) as unknown as Json,
    cv_text: null,
    // Which saved document this ran on — the history list links back to it
    // (the owner, 30/8). A one-off upload keeps its snapshot instead.
    cv_document_id: docId || null,
    checked_file_path: checkedFilePath,
  });

  return { analysis };
}
