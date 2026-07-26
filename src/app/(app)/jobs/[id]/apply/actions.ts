"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend";
import { applyConfirmationEmail } from "@/lib/email/templates";
import type { Json } from "@/types/database";

export type ApplyState = { error?: string };

// Same CV rules as the CV screen (src/app/(app)/cv/actions.ts).
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const CV_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/**
 * Submit an application to one of OUR jobs through the wizard: required
 * per-job answers + the built-in "fit" question, plus a CV — her main
 * (latest) document or a job-tailored upload.
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

  // Required answers — validated against the job's questions, not the form.
  const { data: questions } = await supabase
    .from("job_questions")
    .select("id, required")
    .eq("job_id", jobId);
  const answers: Record<string, string> = {};
  for (const q of questions ?? []) {
    const v = String(formData.get(`q_${q.id}`) ?? "").trim();
    if (!v && q.required !== false) {
      return { error: "כמעט שם — נשארו שאלות חובה בלי תשובה 🙂" };
    }
    if (v) answers[q.id] = v;
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
    const { data: latest } = await supabase
      .from("cv_documents")
      .select("id")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    cvId = latest?.id ?? null;
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
