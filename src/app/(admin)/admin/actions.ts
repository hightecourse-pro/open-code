"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { sendResendEmail } from "@/lib/email/resend";
import { applicationStatusEmail, jobCandidatesEmail } from "@/lib/email/templates";
import { queueEverythingFor, queueRevokeAll } from "@/lib/drive-shares";
import { loadClientJob } from "@/lib/portal/jobs";
import { getSiteUrl } from "@/lib/site";
import type {
  ApplicationStatus,
  EmploymentType,
  JobSource,
  ProfileStatus,
  ReportStatus,
  TaxonomyKind,
  UserRole,
} from "@/types/database";

/** Promote/demote a member's role (void wrapper for direct form actions). */
export async function setMemberRoleAction(id: string, role: UserRole): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/admin/mentors");
  revalidatePath("/admin/members");
}

/**
 * Resolve or dismiss a report. Resolving ("טופל") also removes the reported
 * content from the community — that's what handling a report means.
 */
export async function updateReportStatus(id: string, status: ReportStatus) {
  await requireRole("admin");
  const supabase = await createClient();

  if (status === "reviewed") {
    const { data: report } = await supabase
      .from("reports")
      .select("target_type, target_id")
      .eq("id", id)
      .maybeSingle();
    if (report) {
      const admin = createAdminClient();
      if (report.target_type === "post") {
        // Clear children first in case the FK isn't cascading.
        await admin.from("reactions").delete().eq("post_id", report.target_id);
        await admin.from("comments").delete().eq("post_id", report.target_id);
        await admin.from("posts").delete().eq("id", report.target_id);
      } else {
        await admin.from("comments").delete().eq("id", report.target_id);
      }
    }
  }

  await supabase.from("reports").update({ status }).eq("id", id);
  revalidatePath("/admin/moderation");
  revalidatePath("/forum");
  revalidatePath("/feed");
}

/** Resolve (or reopen) a member's request to be matched with a mentor. */
export async function setMentorRequestStatus(id: string, status: "open" | "handled"): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("mentor_requests")
    .update({ status, handled_at: status === "handled" ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/admin/mentor-requests");
  revalidatePath("/mentor");
}

export type CrmState = { error?: string };

/**
 * Toggle a member's VIP star, with an optional admin-only reason. Lives in
 * member_crm (admin-only RLS) — never on profiles, which members can read.
 */
export async function toggleVip(id: string, isVip: boolean, reason?: string): Promise<CrmState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("member_crm").upsert(
    { profile_id: id, is_vip: isVip, vip_reason: isVip ? reason?.trim() || null : null },
    { onConflict: "profile_id" }
  );
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${id}`);
  if (error) return { error: "השמירה נכשלה. רענני את הדף ונסי שוב." };
  return {};
}

/** Save internal notes on a member (admin-only, for screening). */
export async function saveInternalNotes(id: string, notes: string): Promise<CrmState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("member_crm").upsert(
    { profile_id: id, internal_notes: notes.trim() || null },
    { onConflict: "profile_id" }
  );
  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${id}`);
  if (error) return { error: "השמירה נכשלה. רענני את הדף ונסי שוב." };
  return {};
}

/** Approve / reject / pause a member. Admin-gated (action + RLS + role check). */
export async function setMemberStatus(profileId: string, status: ProfileStatus) {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ status }).eq("id", profileId);
  if (error) return { error: error.message };

  // Drive access follows membership: approving grants the session material,
  // pausing/rejecting takes it back. Queue-only so the button stays instant —
  // the sync worker does the Drive work.
  try {
    if (status === "active") {
      await queueEverythingFor(profileId);
    } else if (status === "paused" || status === "rejected") {
      await queueRevokeAll(profileId);
    }
  } catch (e) {
    console.error("[drive] member status queue failed:", e);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/members");
  revalidatePath("/admin/shares");
  return {};
}

/** Change a member's role (e.g. promote to mentor). */
export async function setMemberRole(profileId: string, role: UserRole) {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
  if (error) return { error: error.message };
  revalidatePath("/admin/members");
  return {};
}

/** Add a tag/value to a taxonomy list (technologies, regions, specializations…). */
export async function addTaxonomy(kind: TaxonomyKind, labelHe: string): Promise<void> {
  await requireRole("admin");
  const label = labelHe.trim();
  if (!label) return;
  // Derive a stable machine value; Hebrew labels fall back to a random slug.
  const ascii = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const value = ascii || `v${Math.random().toString(36).slice(2, 8)}`;
  const supabase = await createClient();
  await supabase.from("config_taxonomies").insert({ kind, value, label_he: label });
  revalidatePath("/admin/config");
}

/** Remove a tag/value from a taxonomy list. */
export async function removeTaxonomy(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("config_taxonomies").delete().eq("id", id);
  revalidatePath("/admin/config");
}

type QOption = { value: string; label: string };

/** Add an option to a select/multiselect profile question's list. */
export async function addQuestionOption(questionId: string, labelHe: string): Promise<void> {
  await requireRole("admin");
  const label = labelHe.trim();
  if (!label) return;
  const supabase = await createClient();
  const { data: q } = await supabase
    .from("config_questions")
    .select("options")
    .eq("id", questionId)
    .single();
  const current: QOption[] = Array.isArray(q?.options) ? (q!.options as unknown as QOption[]) : [];
  const ascii = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const value = ascii || `v${Math.random().toString(36).slice(2, 8)}`;
  if (current.some((o) => o.value === value || o.label === label)) return;
  const next = [...current, { value, label }];
  await supabase.from("config_questions").update({ options: next as never }).eq("id", questionId);
  revalidatePath("/admin/config");
}

/** Remove an option (by value) from a profile question's list. */
export async function removeQuestionOption(questionId: string, value: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: q } = await supabase
    .from("config_questions")
    .select("options")
    .eq("id", questionId)
    .single();
  const current: QOption[] = Array.isArray(q?.options) ? (q!.options as unknown as QOption[]) : [];
  const next = current.filter((o) => o.value !== value);
  await supabase.from("config_questions").update({ options: next as never }).eq("id", questionId);
  revalidatePath("/admin/config");
}

// Questions that drive the form's structure and must never be disabled.
const STRUCTURAL_QUESTION_KEYS = ["has_experience"];

/** Show / hide a profile question (the dynamic configuration screen). */
export async function toggleQuestionActive(id: string, active: boolean) {
  await requireRole("admin");
  const supabase = await createClient();
  // Never allow disabling a structural question (it breaks the form's branching).
  if (!active) {
    const { data: q } = await supabase.from("config_questions").select("key").eq("id", id).maybeSingle();
    if (q && STRUCTURAL_QUESTION_KEYS.includes(q.key)) {
      return { error: "לא ניתן לכבות שאלה מובנית." };
    }
  }
  const { error } = await supabase.from("config_questions").update({ active }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/config");
  return {};
}

export type PricingState = { error?: string; ok?: boolean };

/** Set community membership pricing (monthly fee ₪, annual discount %, min term). */
export async function updatePricing(
  _prev: PricingState,
  formData: FormData
): Promise<PricingState> {
  await requireRole("admin");

  const monthlyShekels = Number(formData.get("monthly"));
  const annualDiscountPct = Number(formData.get("discount"));
  const minTermMonths = Number(formData.get("minTerm"));

  if (!Number.isFinite(monthlyShekels) || monthlyShekels <= 0) {
    return { error: "מחיר חודשי לא תקין." };
  }
  if (!Number.isFinite(annualDiscountPct) || annualDiscountPct < 0 || annualDiscountPct > 100) {
    return { error: "אחוז הנחה צריך להיות בין 0 ל-100." };
  }
  if (!Number.isFinite(minTermMonths) || minTermMonths < 1) {
    return { error: "מינימום חודשים לא תקין." };
  }

  const value = {
    monthlyAgorot: Math.round(monthlyShekels * 100),
    annualDiscountPct: Math.round(annualDiscountPct),
    minTermMonths: Math.round(minTermMonths),
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "pricing", value }, { onConflict: "key" });
  if (error) return { error: error.message };

  revalidatePath("/admin/config");
  revalidatePath("/join");
  return { ok: true };
}

export type FormState = { ok?: boolean; error?: string };

const EMPLOYMENT: EmploymentType[] = ["full", "part", "student", "freelance"];

function jobFields(formData: FormData) {
  // Linking a job to a portal client is what routes the right CV to the right
  // employer: a candidate's application to this job is what that client
  // downloads from the portal.
  const clientRaw = String(formData.get("client_id") ?? "").trim();
  const client_id = clientRaw || null;
  const company = String(formData.get("company") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const source: JobSource = String(formData.get("source") ?? "open") === "ours" ? "ours" : "open";
  const empRaw = String(formData.get("employment_type") ?? "full");
  const employment_type: EmploymentType = EMPLOYMENT.includes(empRaw as EmploymentType)
    ? (empRaw as EmploymentType)
    : "full";
  const external_url = String(formData.get("external_url") ?? "").trim() || null;
  return {
    company,
    title,
    source,
    client_id,
    employment_type,
    location: String(formData.get("location") ?? "").trim() || null,
    description: String(formData.get("description") ?? ""),
    tech_tags: String(formData.get("tech") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    external_url,
  };
}

function validateJob(f: ReturnType<typeof jobFields>): string | null {
  if (!f.company || !f.title) return "חברה ותפקיד הם שדות חובה.";
  // Market ("open") jobs are applied to off-site — a link is required.
  if (f.source === "open" && !f.external_url) return "למשרה מהשוק חובה קישור להגשה.";
  return null;
}

/** Everything except the portal link — used to retry before that migration. */
function withoutClient(f: ReturnType<typeof jobFields>) {
  const { client_id: _drop, ...rest } = f;
  void _drop;
  return rest;
}

/** Postgres/PostgREST "column does not exist" — the pre-migration case only. */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || /client_id|cv_document_id|column/i.test(error.message ?? "");
}

/** Post a new job to the board. */
export async function createJob(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const f = jobFields(formData);
  const err = validateJob(f);
  if (err) return { error: err };

  const supabase = await createClient();
  const { error } = await supabase.from("jobs").insert(f);
  if (error) {
    // Backward-safe: retry without the portal link ONLY when that column is
    // what's missing — a real error must still surface.
    if (!isMissingColumn(error)) return { error: error.message };
    const { error: retry } = await supabase.from("jobs").insert(withoutClient(f));
    if (retry) return { error: retry.message };
  }
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  return { ok: true };
}

/** Edit an existing job. */
export async function editJob(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const f = jobFields(formData);
  const err = validateJob(f);
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update(f).eq("id", jobId);
  if (error) {
    if (!isMissingColumn(error)) return { error: error.message };
    const { error: retry } = await supabase.from("jobs").update(withoutClient(f)).eq("id", jobId);
    if (retry) return { error: retry.message };
  }
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  return { ok: true };
}

/** Close (or reopen) a job — closed jobs disappear from the members' board. */
export async function setJobStatus(jobId: string, open: boolean): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("jobs").update({ status: open ? "open" : "closed" }).eq("id", jobId);
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
}

/** Delete a job permanently. */
export async function deleteJob(jobId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("jobs").delete().eq("id", jobId);
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
}

// ------------------------------------------------------- portal job candidates

/** Curate a candidate onto a client's job (shown to the client in the portal). */
export async function addJobCandidate(jobId: string, profileId: string): Promise<void> {
  const me = await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("job_candidates")
    .upsert({ job_id: jobId, profile_id: profileId, created_by: me.id }, { onConflict: "job_id,profile_id" });
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
}

/** Remove a curated candidate from a job. */
export async function removeJobCandidate(jobId: string, profileId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("job_candidates").delete().eq("job_id", jobId).eq("profile_id", profileId);
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
}

/**
 * Email the client the candidates curated for their job, with a link straight
 * into that job in the portal. The names are resolved through loadClientJob —
 * the same privacy gate the portal renders behind — so a member who opted out
 * (or is paused / no longer a listed junior) is never named to the client,
 * even if she is still a row in job_candidates.
 */
export async function sendJobCandidatesToClient(jobId: string): Promise<{ ok?: boolean; error?: string }> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id, title, client_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "המשרה לא נמצאה." };
  if (!job.client_id) return { error: "המשרה לא מקושרת ללקוח פורטל. חברי אותה ללקוח בעריכת המשרה." };

  const { data: client } = await admin
    .from("portal_clients")
    .select("company_name, contact_email")
    .eq("id", job.client_id)
    .maybeSingle();
  if (!client?.contact_email) {
    return { error: "ללקוח אין אימייל ליצירת קשר. הוסיפי אותו במסך לקוחות פורטל." };
  }

  // Resolve names through the portal's single door, never from profiles
  // directly — this drops any curated candidate the client can't actually see,
  // so the email and the portal job page always name exactly the same people.
  const clientJob = await loadClientJob(job.client_id, jobId);
  const names = (clientJob?.candidates ?? []).map((c) => c.name).filter(Boolean);
  if (names.length === 0) {
    return {
      error:
        "אין מועמדות שניתן להציג ללקוח למשרה הזו. ודאי שהוספת מועמדות פעילות המפורסמות בפורטל.",
    };
  }

  const built = jobCandidatesEmail(
    client.company_name,
    job.title,
    names,
    `${getSiteUrl()}/portal/job/${jobId}`
  );
  const sent = await sendResendEmail({ to: client.contact_email, subject: built.subject, html: built.html });
  if (!sent.ok) {
    console.error("[job candidates email] send failed:", sent.error);
    return { error: "המייל לא נשלח. נסי שוב." };
  }
  return { ok: true };
}

/** Update a candidate application's status (internal-job pipeline). */
export async function setApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("applications").update({ status }).eq("id", applicationId);
  revalidatePath("/admin/jobs");
  // The member sees the new status on her jobs page.
  revalidatePath("/jobs");

  // Best-effort: tell the applicant by email so the status change actually
  // reaches her (in-review / accepted / rejected only).
  if (status === "in_review" || status === "accepted" || status === "rejected") {
    try {
      const { data: app } = await supabase
        .from("applications")
        .select("applicant_id, job_id")
        .eq("id", applicationId)
        .single();
      if (app) {
        const [{ data: job }, { data: profile }] = await Promise.all([
          supabase.from("jobs").select("title, company").eq("id", app.job_id).single(),
          supabase.from("profiles").select("first_name, full_name").eq("id", app.applicant_id).single(),
        ]);
        const { data: authUser } = await createAdminClient().auth.admin.getUserById(app.applicant_id);
        const email = authUser?.user?.email;
        if (email && job) {
          const name = profile?.first_name || profile?.full_name?.split(" ")[0] || undefined;
          const built = applicationStatusEmail(job.title, job.company, status, name);
          const sent = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
          if (!sent.ok) console.error("[application email] send failed:", sent.error);
        }
      }
    } catch (e) {
      console.error("[application email] failed:", e);
    }
  }
}

/** Soft-cancel a session: shows "בוטל" and auto-hides from members after 24h. */
export async function cancelSession(sessionId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("sessions").update({ canceled_at: new Date().toISOString() }).eq("id", sessionId);
  revalidatePath("/admin/sessions");
  revalidatePath("/events");
}

/** Delete a session immediately (e.g. added by mistake). */
export async function deleteSession(sessionId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("sessions").delete().eq("id", sessionId);
  revalidatePath("/admin/sessions");
  revalidatePath("/admin/content");
  revalidatePath("/events");
}

/** Mark a session as finished. */
export async function markSessionDone(sessionId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("sessions").update({ status: "done" }).eq("id", sessionId);
  revalidatePath("/admin/sessions");
  revalidatePath("/events");
}

/** Schedule a new community session. */
export async function createSession(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const title = String(formData.get("title") ?? "").trim();
  const scheduledAt = String(formData.get("scheduled_at") ?? "");
  if (!title || !scheduledAt) return { error: "כותרת ומועד הם שדות חובה." };

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").insert({
    title,
    topic: String(formData.get("topic") ?? "") || null,
    scheduled_at: new Date(scheduledAt).toISOString(),
    zoom_url: String(formData.get("zoom_url") ?? "") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/sessions");
  revalidatePath("/events");
  return { ok: true };
}
