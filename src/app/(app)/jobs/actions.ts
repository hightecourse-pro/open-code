"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function toggleSaveJob(jobId: string, save: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (save) {
    await supabase.from("saved_jobs").insert({ job_id: jobId, profile_id: user.id });
  } else {
    await supabase.from("saved_jobs").delete().eq("job_id", jobId).eq("profile_id", user.id);
  }
  revalidatePath("/jobs");
}

/**
 * One-click apply — for MARKET jobs only. An internal job ('ours') always goes
 * through the wizard at /jobs/[id]/apply, which validates her answers to the
 * job's questions against the DB; letting this action create those applications
 * would hand the review centre an empty submission nobody can explain.
 *
 * Optionally attaches a specific CV — that attachment is what the employer
 * downloads from the portal. With no explicit choice we attach the CV she
 * tailored for a job if she has one, falling back to her most recent Hebrew CV.
 */
export async function applyToJob(
  jobId: string,
  cvDocumentId?: string
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // The gate: open, still hiring, and visible to her (RLS hides targeted jobs
  // she isn't an audience for, so a plain select is the visibility check).
  const { data: job } = await supabase
    .from("jobs")
    .select("id, source, status")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "המשרה הזו כבר לא זמינה." };
  if (job.status !== "open") return { error: "המשרה הזו נסגרה — אבל יש עוד 💜" };
  if (job.source === "ours") {
    return { error: "למשרה הזו מגישים דרך טופס ההגשה — כדי שנוכל להציג אותך במלואך." };
  }

  let cvId = cvDocumentId ?? null;
  if (cvId) {
    // Only ever attach a document that is actually hers.
    const { data: own } = await supabase
      .from("cv_documents")
      .select("id")
      .eq("id", cvId)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!own) cvId = null;
  }
  if (!cvId) {
    const { data: docs } = await supabase
      .from("cv_documents")
      .select("id, language, created_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });
    const preferred =
      (docs ?? []).find((d) => d.language === "job") ??
      (docs ?? []).find((d) => d.language === "he") ??
      (docs ?? [])[0];
    cvId = preferred?.id ?? null;
  }

  const base = { job_id: jobId, applicant_id: user.id, status: "submitted" as const };
  let { error } = await supabase.from("applications").insert({ ...base, cv_document_id: cvId });
  if (error) {
    // Backward-safe: applying must work before the portal migration adds the
    // cv_document_id column.
    ({ error } = await supabase.from("applications").insert(base));
  }

  revalidatePath("/jobs");
  if (error) {
    // Only a unique-violation really means "already applied". Anything else is
    // our problem, and saying otherwise would leave her thinking she applied.
    if (error.code === "23505") return { error: "כבר הגשת למשרה הזו 💜" };
    console.error("[jobs] apply failed:", error.message);
    return { error: "משהו השתבש אצלנו ברגע הזה — נסי שוב בעוד רגע, ואם זה חוזר כתבי לנו." };
  }
  return { ok: true };
}
