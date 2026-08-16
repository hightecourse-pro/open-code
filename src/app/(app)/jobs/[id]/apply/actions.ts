"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend";
import { applyConfirmationEmail } from "@/lib/email/templates";
import type { Json, QuestionAnswerType } from "@/types/database";

export type ApplyState = { error?: string };

const ANSWER_TYPES: QuestionAnswerType[] = ["paragraph", "number", "select", "multiselect"];

// Same CV rules as the CV screen (src/app/(app)/cv/actions.ts).
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const CV_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * Submit an application to one of OUR jobs through the wizard: required
 * per-job answers + the built-in "fit" question, plus a CV — the document she
 * marked as her default, or a job-tailored upload.
 */
export async function submitApplication(
  jobId: string,
  _prev: ApplyState,
  formData: FormData
): Promise<ApplyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The job must be visible to her (RLS gates targeted jobs), ours and open.
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, source, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.source !== "ours" || job.status !== "open") {
    return { error: "המשרה כבר לא זמינה להגשה." };
  }

  // Required answers — validated per answer type against the job's questions
  // in the DB, never against whatever the form happened to send.
  const { data: questions } = await supabase
    .from("job_questions")
    .select("id, question, required, answer_type, options")
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const answers: Record<string, string | number | string[]> = {};
  for (const q of questions ?? []) {
    const required = q.required !== false;
    const type: QuestionAnswerType = ANSWER_TYPES.includes(q.answer_type)
      ? q.answer_type
      : "paragraph";
    const options = Array.isArray(q.options)
      ? q.options.filter((o): o is string => typeof o === "string")
      : [];

    if (type === "multiselect") {
      const values = formData
        .getAll(`q_${q.id}`)
        .map((v) => String(v).trim())
        .filter(Boolean);
      if (values.length === 0) {
        if (required) return { error: `חסרה תשובה לשאלה: ${q.question}` };
        continue;
      }
      if (!values.every((v) => options.includes(v))) {
        return { error: `תשובה לא תקינה לשאלה: ${q.question}` };
      }
      answers[q.id] = values;
      continue;
    }

    const v = String(formData.get(`q_${q.id}`) ?? "").trim();
    if (!v) {
      if (required) return { error: `חסרה תשובה לשאלה: ${q.question}` };
      continue;
    }
    if (type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) return { error: `תשובה לא תקינה לשאלה: ${q.question}` };
      answers[q.id] = n;
    } else if (type === "select") {
      if (!options.includes(v)) return { error: `תשובה לא תקינה לשאלה: ${q.question}` };
      answers[q.id] = v;
    } else {
      answers[q.id] = v;
    }
  }
  const fit = String(formData.get("fit") ?? "").trim();
  if (!fit) return { error: "ספרי לנו למה את מתאימה למשרה — זו הדרך שלך לבלוט 💜" };
  answers.fit = fit;

  // CV: her main (latest) document, or a job-tailored upload.
  let cvId: string | null = null;
  const cvMode = String(formData.get("cv_mode") ?? "main");
  if (cvMode === "upload") {
    const file = formData.get("cv_file");
    if (!(file instanceof File) || file.size === 0) return { error: "בחרי קובץ קורות חיים להעלאה." };
    if (file.size > MAX_BYTES) return { error: "הקובץ גדול מדי — עד 10MB." };
    const okType = /\.(pdf|docx?)$/i.test(file.name) || CV_TYPES.includes(file.type);
    if (!okType) return { error: "אפשר להעלות רק PDF או Word (doc/docx)." };

    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${user.id}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("cvs")
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (upErr) return { error: "העלאת הקובץ נכשלה. נסי שוב." };

    const { data: doc, error: docErr } = await supabase
      .from("cv_documents")
      .insert({
        profile_id: user.id,
        label: `מותאם: ${job.title}`,
        language: "job",
        file_path: path,
        file_name: file.name,
      })
      .select("id")
      .single();
    if (docErr || !doc) return { error: "הקובץ הועלה אבל לא נשמר. נסי שוב." };
    cvId = doc.id;
  } else {
    // The CV she marked as default on /cv — never "whatever she uploaded last",
    // which could be a CV she tailored for a different job. Pre-migration the
    // column doesn't exist yet (42703), so newest-first stays the fallback.
    const marked = await supabase
      .from("cv_documents")
      .select("id")
      .eq("profile_id", user.id)
      .eq("is_default", true)
      .maybeSingle();
    cvId = marked.error ? null : (marked.data?.id ?? null);
    if (!cvId) {
      const { data: latest } = await supabase
        .from("cv_documents")
        .select("id")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      cvId = latest?.id ?? null;
    }
  }

  // An application is a CV in front of an employer — never let one through
  // without a document behind it (the form preselects upload when she has
  // none, but the server is the gate).
  if (!cvId) {
    return { error: "אי אפשר להגיש בלי קורות חיים — העלי קובץ מותאם או העלי קודם קו״ח בעמוד קורות החיים 💜" };
  }

  const base = { job_id: jobId, applicant_id: user.id, status: "submitted" as const };
  let { error } = await supabase.from("applications").insert({
    ...base,
    cv_document_id: cvId,
    answers: answers as unknown as Json,
  });
  if (error?.code === "23505") return { error: "כבר הגשת למשרה הזו 💜" };
  if (error) {
    // Backward-safe: retry without newer-migration columns only when a column
    // is what's missing.
    const missing = error.code === "42703" || /answers|cv_document_id|column/i.test(error.message ?? "");
    if (!missing) return { error: "ההגשה נכשלה. נסי שוב." };
    ({ error } = await supabase.from("applications").insert(base));
    if (error?.code === "23505") return { error: "כבר הגשת למשרה הזו 💜" };
    if (error) return { error: "ההגשה נכשלה. נסי שוב." };
  }

  // Best-effort confirmation email — the application is already in.
  try {
    const [{ data: profile }, { data: authUser }] = await Promise.all([
      supabase.from("profiles").select("first_name, full_name").eq("id", user.id).single(),
      createAdminClient().auth.admin.getUserById(user.id),
    ]);
    const email = authUser?.user?.email;
    if (email) {
      const name = profile?.first_name || profile?.full_name?.split(" ")[0] || undefined;
      const built = applyConfirmationEmail(name, job.title);
      const sent = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
      if (!sent.ok) console.error("[apply confirmation email] send failed:", sent.error);
    }
  } catch (e) {
    console.error("[apply confirmation email] failed:", e);
  }

  revalidatePath("/jobs");
  redirect("/jobs?applied=1");
}
