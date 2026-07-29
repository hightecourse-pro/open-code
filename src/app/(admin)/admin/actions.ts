"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { sendResendEmail } from "@/lib/email/resend";
import {
  applicationPipelineEmail,
  applicationStatusEmail,
  assignedMentorEmail,
  candidateSubmittedEmail,
  jobCandidatesEmail,
  jobPublishedEmail,
} from "@/lib/email/templates";
import { queueEverythingFor, queueRevokeAll } from "@/lib/drive-shares";
import { loadClientJob } from "@/lib/portal/jobs";
import { decryptPassword } from "@/lib/portal/auth";
import { getSiteUrl } from "@/lib/site";
import { htmlToPlainText, sanitizeRichHtml } from "@/lib/rich-text";
import type {
  ApplicationStatus,
  ClientCrmStatus,
  EmploymentType,
  JobKind,
  JobSource,
  JobStatus,
  ProfileStatus,
  QuestionAnswerType,
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

/**
 * Assign a mentor to a member's request: marks it handled with the mentor
 * recorded, and tells the member who will accompany her (best-effort email).
 */
export async function assignMentorToRequest(requestId: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const mentorId = String(formData.get("mentor_id") ?? "");
  if (!mentorId) return;
  const supabase = await createClient();

  const { data: req } = await supabase
    .from("mentor_requests")
    .select("id, profile_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) return;

  const { error } = await supabase
    .from("mentor_requests")
    .update({
      assigned_mentor_id: mentorId,
      status: "handled",
      handled_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (error) return;

  // Best-effort: a failed email never rolls back the assignment.
  try {
    const [{ data: member }, { data: mentor }] = await Promise.all([
      supabase.from("profiles").select("first_name, full_name").eq("id", req.profile_id).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", mentorId).maybeSingle(),
    ]);
    const admin = createAdminClient();
    const { data: authUser } = await admin.auth.admin.getUserById(req.profile_id);
    const email = authUser?.user?.email;
    if (email) {
      const built = assignedMentorEmail(
        member?.first_name || member?.full_name || undefined,
        mentor?.full_name || "מנטורית מהקהילה"
      );
      const sent = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
      if (!sent.ok) console.error("[assign mentor email] send failed:", sent.error);
    }
  } catch (e) {
    console.error("[assign mentor email] failed:", e);
  }

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
const JOB_KINDS: JobKind[] = [
  "immediate",
  "practicum_placement",
  "practicum_percent",
  "practicum_free",
  "other",
];

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

  const kindRaw = String(formData.get("job_kind") ?? "immediate");
  const job_kind: JobKind = JOB_KINDS.includes(kindRaw as JobKind)
    ? (kindRaw as JobKind)
    : "immediate";
  // The employer's hire-percentage only means something on a percent-practicum
  // job — anything else (or an empty/invalid value) is stored as null.
  const pctRaw = String(formData.get("practicum_percent") ?? "").trim();
  const pct = pctRaw ? Math.round(Number(pctRaw)) : NaN;
  const practicum_percent =
    job_kind === "practicum_percent" && Number.isFinite(pct) && pct >= 1 && pct <= 100 ? pct : null;

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
    job_kind,
    practicum_percent,
    description_html: sanitizeRichHtml(String(formData.get("description_html") ?? "")) || null,
  };
}

/**
 * The plain description mirrors the rich one (line breaks kept, styling
 * dropped) — the admin writes once. A manually typed plain text only wins
 * when no rich text exists.
 */
function withDerivedDescription(f: ReturnType<typeof jobFields>) {
  const derived = htmlToPlainText(f.description_html);
  return { ...f, description: derived || f.description };
}

function validateJob(f: ReturnType<typeof jobFields>): string | null {
  if (!f.company || !f.title) return "חברה ותפקיד הם שדות חובה.";
  // Our jobs always belong to a client — the whole pipeline (portal, send-to-
  // client, CRM) hangs off that link, so it's chosen first, never afterthought.
  if (f.source === "ours" && !f.client_id)
    return "למשרה שלנו חובה לבחור לקוח — בחרי מהרשימה או צרי לקוח חדש.";
  // Market ("open") jobs are applied to off-site — a link is required.
  if (f.source === "open" && !f.external_url) return "למשרה מהשוק חובה קישור להגשה.";
  return null;
}

/** Everything except the portal link — used to retry before that migration. */
function withoutClient<T extends { client_id: string | null }>(f: T) {
  const { client_id: _drop, ...rest } = f;
  void _drop;
  return rest;
}

/** Everything except the CRM-migration columns (_jobs_crm.sql) — retry before it ran. */
function withoutCrmColumns<T extends { job_kind: JobKind; practicum_percent: number | null; description_html: string | null }>(
  f: T
) {
  const { job_kind: _k, practicum_percent: _p, description_html: _d, ...rest } = f;
  void _k;
  void _p;
  void _d;
  return rest;
}

/** Postgres/PostgREST "column does not exist" — the pre-migration case only. */
function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "42703" ||
    /client_id|cv_document_id|job_kind|practicum_percent|description_html|column/i.test(
      error.message ?? ""
    )
  );
}

const ANSWER_TYPES: QuestionAnswerType[] = ["paragraph", "number", "select", "multiselect"];

interface CleanJobQuestion {
  question: string;
  answer_type: QuestionAnswerType;
  options: string[] | null;
}

/**
 * Sanitize an admin-typed application question: trimmed non-empty text, a
 * valid answer type (anything else → paragraph) and — for the two choice
 * types — deduped non-empty options (max 20). A choice question with fewer
 * than two options degrades to a free-text paragraph.
 */
function sanitizeJobQuestion(
  rawQuestion: unknown,
  rawType: unknown,
  rawOptions: unknown
): CleanJobQuestion | null {
  const question = String(rawQuestion ?? "").trim();
  if (!question) return null;
  let answer_type: QuestionAnswerType = ANSWER_TYPES.includes(rawType as QuestionAnswerType)
    ? (rawType as QuestionAnswerType)
    : "paragraph";
  let options: string[] | null = null;
  if (answer_type === "select" || answer_type === "multiselect") {
    const list = Array.isArray(rawOptions) ? rawOptions : [];
    const clean = [...new Set(list.map((o) => String(o ?? "").trim()).filter(Boolean))].slice(0, 20);
    if (clean.length >= 2) options = clean;
    else answer_type = "paragraph";
  }
  return { question, answer_type, options };
}

/** Post a new job to the board. */
export async function createJob(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const fields = jobFields(formData);
  const err = validateJob(fields);
  if (err) return { error: err };

  // An "ours" job is born CLOSED (invisible on the board) — it goes live only
  // when the admin publishes it to its audience. Market jobs open immediately.
  const f = {
    ...withDerivedDescription(fields),
    status: (fields.source === "ours" ? "closed" : "open") as JobStatus,
  };

  const supabase = await createClient();
  let jobId: string | null = null;
  const { data: created, error } = await supabase.from("jobs").insert(f).select("id").single();
  jobId = created?.id ?? null;
  if (error) {
    // Backward-safe: retry without newer-migration columns ONLY when a column
    // is what's missing — a real error must still surface. First without the
    // CRM columns (_jobs_crm.sql), then also without the portal link.
    if (!isMissingColumn(error)) return { error: error.message };
    const { data: r1, error: retry } = await supabase
      .from("jobs")
      .insert(withoutCrmColumns(f))
      .select("id")
      .single();
    jobId = r1?.id ?? null;
    if (retry) {
      if (!isMissingColumn(retry)) return { error: retry.message };
      const { data: r2, error: retry2 } = await supabase
        .from("jobs")
        .insert(withoutClient(withoutCrmColumns(f)))
        .select("id")
        .single();
      jobId = r2?.id ?? null;
      if (retry2) return { error: retry2.message };
    }
  }

  // Required application questions typed during creation (JSON array of
  // {question, answer_type, options} objects — legacy plain strings still
  // parse). Best-effort — the job itself is already saved.
  if (jobId) {
    try {
      const raw = JSON.parse(String(formData.get("questions") ?? "[]")) as unknown;
      const questions = (Array.isArray(raw) ? raw : [])
        .map((q) =>
          typeof q === "object" && q !== null
            ? sanitizeJobQuestion(
                (q as Record<string, unknown>).question,
                (q as Record<string, unknown>).answer_type,
                (q as Record<string, unknown>).options
              )
            : sanitizeJobQuestion(q, "paragraph", null)
        )
        .filter((q): q is CleanJobQuestion => q !== null)
        .slice(0, 20);
      if (questions.length) {
        const { error: qError } = await supabase.from("job_questions").insert(
          questions.map((q, i) => ({
            job_id: jobId!,
            question: q.question,
            answer_type: q.answer_type,
            options: q.options,
            sort_order: i,
          }))
        );
        if (qError && isMissingColumn(qError)) {
          // Pre-migration DB: keep the questions, drop the answer-type columns.
          await supabase
            .from("job_questions")
            .insert(questions.map((q, i) => ({ job_id: jobId!, question: q.question, sort_order: i })));
        } else if (qError) {
          console.error("[create job] questions insert failed:", qError);
        }
      }
    } catch (e) {
      console.error("[create job] questions insert failed:", e);
    }
  }

  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  // Back to the list, with the fresh job on top.
  redirect("/admin/jobs?created=1");
}

/** Edit an existing job. */
export async function editJob(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const f = withDerivedDescription(jobFields(formData));
  const err = validateJob(f);
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update(f).eq("id", jobId);
  if (error) {
    if (!isMissingColumn(error)) return { error: error.message };
    const { error: retry } = await supabase.from("jobs").update(withoutCrmColumns(f)).eq("id", jobId);
    if (retry) {
      if (!isMissingColumn(retry)) return { error: retry.message };
      const { error: retry2 } = await supabase
        .from("jobs")
        .update(withoutClient(withoutCrmColumns(f)))
        .eq("id", jobId);
      if (retry2) return { error: retry2.message };
    }
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

// ------------------------------------------------------------ job questions
// The built-in question ("למה את חושבת שאת מתאימה למשרה?") lives in code —
// these are only the extra, per-job questions the admin defines.

/** Add a required application question to a job (appended last). */
export async function addJobQuestion(
  jobId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin");
  const parsed = sanitizeJobQuestion(
    formData.get("question"),
    String(formData.get("answer_type") ?? "paragraph"),
    String(formData.get("options") ?? "").split(",")
  );
  if (!parsed) return { error: "כתבי את נוסח השאלה." };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("job_questions")
    .select("sort_order")
    .eq("job_id", jobId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (last?.sort_order ?? -1) + 1;
  const { error } = await supabase.from("job_questions").insert({
    job_id: jobId,
    question: parsed.question,
    answer_type: parsed.answer_type,
    options: parsed.options,
    sort_order,
  });
  if (error) {
    // Pre-migration DB: keep the question, drop the answer-type columns.
    if (!isMissingColumn(error)) return { error: error.message };
    const { error: retry } = await supabase
      .from("job_questions")
      .insert({ job_id: jobId, question: parsed.question, sort_order });
    if (retry) return { error: retry.message };
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true };
}

/** Remove a question from a job. */
export async function deleteJobQuestion(id: string, jobId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("job_questions").delete().eq("id", id).eq("job_id", jobId);
  revalidatePath(`/admin/jobs/${jobId}`);
}

/** Move a question one step up/down by swapping sort_order with its neighbor. */
export async function moveJobQuestion(id: string, jobId: string, dir: "up" | "down"): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("job_questions")
    .select("id, sort_order")
    .eq("job_id", jobId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!rows || rows.length < 2) return;

  const idx = rows.findIndex((r) => r.id === id);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= rows.length) return;

  const a = rows[idx];
  const b = rows[swapIdx];
  if (a.sort_order !== b.sort_order) {
    await Promise.all([
      supabase.from("job_questions").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("job_questions").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
  } else {
    // Legacy rows can share a sort_order — reindex the whole list (with the
    // two swapped) so every question gets a distinct integer again.
    const order = rows.map((r) => r.id);
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
    await Promise.all(
      order.map((qid, i) =>
        supabase.from("job_questions").update({ sort_order: i }).eq("id", qid)
      )
    );
  }
  revalidatePath(`/admin/jobs/${jobId}`);
}

// ---------------------------------------------------- targeted job publishing

export interface AudienceFilters {
  specialization?: string[];
  region?: string[];
  /** true = experienced only, false = juniors only, undefined = everyone. */
  experienced?: boolean;
}

export interface AudienceMember {
  id: string;
  full_name: string;
  specialization: string | null;
  region: string | null;
}

/**
 * Members eligible for a targeted publish: active, junior, completed profile,
 * matching the criteria. Specialization/region live both as denormalized
 * profile columns and as intake answers (stored as taxonomy VALUES while the
 * columns may hold Hebrew labels) — so a selected option matches either form.
 */
export async function previewAudience(
  jobId: string,
  filters: AudienceFilters
): Promise<{ members?: AudienceMember[]; pool?: number; error?: string }> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: job } = await admin.from("jobs").select("id").eq("id", jobId).maybeSingle();
  if (!job) return { error: "המשרה לא נמצאה." };

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, specialization, region, is_experienced")
    // Placement reaches free members too (user decision 2026-07-29): pending =
    // browsing free member, active = paying. Only paused/rejected stay out.
    .in("status", ["active", "pending"])
    .eq("role", "junior")
    .eq("profile_completed", true)
    .order("full_name", { ascending: true });

  let members = profiles ?? [];
  if (typeof filters.experienced === "boolean") {
    members = members.filter((p) => !!p.is_experienced === filters.experienced);
  }

  const wantSpec = (filters.specialization ?? []).filter(Boolean);
  const wantRegion = (filters.region ?? []).filter(Boolean);

  // value → Hebrew label, for both matching and display.
  const { data: tax } = await admin
    .from("config_taxonomies")
    .select("kind, value, label_he")
    .in("kind", ["specialization", "region"]);
  const labelOf = new Map((tax ?? []).map((t) => [`${t.kind}:${t.value}`, t.label_he]));

  // Intake answers for the two criteria questions (the profile columns can be
  // empty for members who only answered the dynamic form).
  const { data: qs } = await admin
    .from("config_questions")
    .select("id, key")
    .in("key", ["specialization", "region"]);
  const keyOf = new Map((qs ?? []).map((q) => [q.id, q.key]));
  const answerOf = new Map<string, { specialization: string[]; region: string[] }>();
  if ((qs ?? []).length > 0 && members.length > 0) {
    const { data: ans } = await admin
      .from("profile_answers")
      .select("profile_id, question_id, value")
      .in("question_id", (qs ?? []).map((q) => q.id))
      .in("profile_id", members.map((m) => m.id));
    for (const a of ans ?? []) {
      const key = keyOf.get(a.question_id);
      if (key !== "specialization" && key !== "region") continue;
      const entry = answerOf.get(a.profile_id) ?? { specialization: [], region: [] };
      const raw = Array.isArray(a.value) ? a.value : [a.value];
      for (const v of raw) if (typeof v === "string" && v.trim()) entry[key].push(v.trim());
      answerOf.set(a.profile_id, entry);
    }
  }

  const pool = (
    m: (typeof members)[number],
    kind: "specialization" | "region"
  ): string[] => {
    const col = kind === "specialization" ? m.specialization : m.region;
    return [...(col ? [col] : []), ...(answerOf.get(m.id)?.[kind] ?? [])].map((v) =>
      v.trim().toLowerCase()
    );
  };
  const matches = (
    m: (typeof members)[number],
    kind: "specialization" | "region",
    wanted: string[]
  ): boolean => {
    const have = pool(m, kind);
    return wanted.some((v) => {
      const value = v.trim().toLowerCase();
      const label = (labelOf.get(`${kind}:${v}`) ?? "").trim().toLowerCase();
      return have.some((h) => h === value || (label !== "" && h === label));
    });
  };

  // A criterion with EVERY option checked excludes no one — including members
  // whose profile simply doesn't carry that field yet. Only a real narrowing
  // (a strict subset of the options) filters.
  const totalOf = (kind: string) => (tax ?? []).filter((t) => t.kind === kind).length;
  const specNarrows = wantSpec.length > 0 && wantSpec.length < totalOf("specialization");
  const regionNarrows = wantRegion.length > 0 && wantRegion.length < totalOf("region");

  if (specNarrows) members = members.filter((m) => matches(m, "specialization", wantSpec));
  if (regionNarrows) members = members.filter((m) => matches(m, "region", wantRegion));

  // Display: prefer the profile column, fall back to the first answer, and
  // swap machine values for their Hebrew labels.
  const display = (m: (typeof members)[number], kind: "specialization" | "region") => {
    const raw =
      (kind === "specialization" ? m.specialization : m.region) ??
      answerOf.get(m.id)?.[kind]?.[0] ??
      null;
    if (!raw) return null;
    return labelOf.get(`${kind}:${raw}`) ?? raw;
  };

  return {
    members: members.map((m) => ({
      id: m.id,
      full_name: m.full_name,
      specialization: display(m, "specialization"),
      region: display(m, "region"),
    })),
    // The pre-criteria pool — lets the UI distinguish "the community has no
    // eligible members yet" from "the criteria filtered everyone out".
    pool: (profiles ?? []).length,
  };
}

/** Plain-text excerpt of the job description for the email body. */
function jobExcerpt(html: string | null, fallback: string, max = 200): string {
  const text = (html ? html.replace(/<[^>]*>/g, " ") : fallback)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/**
 * Publish a job to its chosen audience: write job_targets, flip the job to
 * published/open, and email every target that wasn't emailed yet — so
 * re-publishing with a wider audience only mails the newly added members.
 */
export async function publishJob(
  jobId: string,
  profileIds: string[]
): Promise<{ ok?: boolean; error?: string; sent?: number; failed?: number }> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id, title, company, description, description_html, published_at")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "המשרה לא נמצאה." };

  const ids = [...new Set(profileIds.filter(Boolean))];
  if (ids.length === 0) return { error: "בחרי לפחות חברה אחת לפרסום המשרה." };

  const { error: targetsError } = await admin.from("job_targets").upsert(
    ids.map((profile_id) => ({ job_id: jobId, profile_id, source: "criteria" as const })),
    { onConflict: "job_id,profile_id", ignoreDuplicates: true }
  );
  if (targetsError) {
    if (isMissingColumn(targetsError)) {
      return { error: "צריך להריץ קודם את ה-SQL האחרון (_jobs_crm.sql) ב-Supabase." };
    }
    return { error: "שמירת קהל היעד נכשלה. נסי שוב." };
  }

  const { error: jobError } = await admin
    .from("jobs")
    .update({
      pipeline_status: "published",
      status: "open",
      published_at: job.published_at ?? new Date().toISOString(),
    })
    .eq("id", jobId);
  if (jobError) return { error: "עדכון סטטוס המשרה נכשל. נסי שוב." };

  // Email only targets that never got the announcement.
  const { data: pending } = await admin
    .from("job_targets")
    .select("profile_id")
    .eq("job_id", jobId)
    .is("emailed_at", null);
  const toEmail = (pending ?? []).map((t) => t.profile_id);

  const { data: named } = toEmail.length
    ? await admin.from("profiles").select("id, first_name, full_name").in("id", toEmail)
    : { data: [] as { id: string; first_name: string | null; full_name: string }[] };
  const nameOf = new Map((named ?? []).map((p) => [p.id, p]));

  const excerpt = jobExcerpt(job.description_html, job.description);
  const applyUrl = `${getSiteUrl()}/jobs`;
  let sent = 0;
  let failed = 0;
  for (const profileId of toEmail) {
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(profileId);
      const email = authUser?.user?.email;
      if (!email) {
        failed++;
        continue;
      }
      const p = nameOf.get(profileId);
      const name = p?.first_name || p?.full_name?.split(" ")[0] || undefined;
      const built = jobPublishedEmail(name, job.title, excerpt, applyUrl);
      const result = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
      if (result.ok) {
        sent++;
        await admin
          .from("job_targets")
          .update({ emailed_at: new Date().toISOString() })
          .eq("job_id", jobId)
          .eq("profile_id", profileId);
      } else {
        failed++;
        console.error("[publish job email] send failed:", result.error);
      }
    } catch (e) {
      failed++;
      console.error("[publish job email] failed:", e);
    }
  }

  revalidatePath("/admin/jobs");
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/forum");
  return { ok: true, sent, failed };
}

/**
 * Bring a published job back to draft so the admin can adjust the audience and
 * publish again. Existing targets keep seeing the job (status stays open);
 * re-publishing emails only newly added members.
 */
export async function reopenJobPublish(jobId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("jobs").update({ pipeline_status: "draft" }).eq("id", jobId);
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
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
 *
 * The email also carries the client's portal credentials and an optional
 * personal note; each candidate actually sent gets her own "הגשנו אותך" email
 * and — if she applied — her application flips to status "sent".
 */
export async function sendJobCandidatesToClient(
  jobId: string,
  personalNote?: string
): Promise<{ ok?: boolean; error?: string }> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id, title, client_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return { error: "המשרה לא נמצאה." };
  if (!job.client_id) return { error: "המשרה לא מקושרת ללקוח פורטל. חברי אותה ללקוח בעריכת המשרה." };

  // Service-role read: the password is stored encrypted (reversible — see
  // portal/auth.ts) exactly so it can be handed to the client here.
  const { data: client } = await admin
    .from("portal_clients")
    .select("company_name, contact_email, username, password_enc")
    .eq("id", job.client_id)
    .maybeSingle();
  if (!client?.contact_email) {
    return { error: "ללקוח אין אימייל ליצירת קשר. הוסיפי אותו במסך לקוחות פורטל." };
  }
  const password = decryptPassword(client.password_enc);
  if (!client.username || !password) {
    return { error: "ללקוח אין עדיין פרטי גישה — הקצי במסך לקוחות פורטל." };
  }

  // Resolve names through the portal's single door, never from profiles
  // directly — this drops any curated candidate the client can't actually see,
  // so the email and the portal job page always name exactly the same people.
  const clientJob = await loadClientJob(job.client_id, jobId);
  const sentCandidates = clientJob?.candidates ?? [];
  const names = sentCandidates.map((c) => c.name).filter(Boolean);
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
    `${getSiteUrl()}/portal/job/${jobId}`,
    {
      personalNote: personalNote?.trim() || null,
      credentials: { username: client.username, password },
    }
  );
  const sent = await sendResendEmail({ to: client.contact_email, subject: built.subject, html: built.html });
  if (!sent.ok) {
    console.error("[job candidates email] send failed:", sent.error);
    return { error: "המייל לא נשלח. נסי שוב." };
  }

  // The client has the list — the job pipeline moves to "candidates sent".
  const { error: pipelineError } = await admin
    .from("jobs")
    .update({ pipeline_status: "candidates_sent" })
    .eq("id", jobId);
  if (pipelineError) console.error("[job candidates] pipeline update failed:", pipelineError);

  // Everything below is best-effort per candidate — the client email is out.
  const now = new Date().toISOString();
  const candidateIds = sentCandidates.map((c) => c.id);
  const { data: apps } = candidateIds.length
    ? await admin
        .from("applications")
        .select("id, applicant_id")
        .eq("job_id", jobId)
        .in("applicant_id", candidateIds)
    : { data: [] as { id: string; applicant_id: string }[] };
  const appOf = new Map((apps ?? []).map((a) => [a.applicant_id, a.id]));

  const { data: people } = candidateIds.length
    ? await admin.from("profiles").select("id, first_name, full_name").in("id", candidateIds)
    : { data: [] as { id: string; first_name: string | null; full_name: string }[] };
  const personOf = new Map((people ?? []).map((p) => [p.id, p]));

  for (const candidate of sentCandidates) {
    const applicationId = appOf.get(candidate.id);
    if (applicationId) {
      const { error: appError } = await admin
        .from("applications")
        .update({ status: "sent", sent_to_client_at: now })
        .eq("id", applicationId);
      if (appError) console.error("[job candidates] application update failed:", appError);
    }
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(candidate.id);
      const email = authUser?.user?.email;
      if (!email) continue;
      const p = personOf.get(candidate.id);
      const name = p?.first_name || p?.full_name?.split(" ")[0] || undefined;
      const memberBuilt = candidateSubmittedEmail(name, job.title, !!applicationId);
      const memberSent = await sendResendEmail({
        to: email,
        subject: memberBuilt.subject,
        html: memberBuilt.html,
      });
      if (!memberSent.ok) console.error("[candidate submitted email] send failed:", memberSent.error);
    } catch (e) {
      console.error("[candidate submitted email] failed:", e);
    }
  }

  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  return { ok: true };
}

// ------------------------------------------------------------- review center

export type AdminMark = "optional" | "not_fit" | "approved";

/**
 * Internal review mark on an application (אופציונלית / לא מתאימה / אישור
 * סופי). Admin-only — never surfaces to the member or the client.
 */
export async function setApplicationMark(
  applicationId: string,
  mark: AdminMark | null
): Promise<FormState> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, job_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "ההגשה לא נמצאה." };

  const { error } = await admin
    .from("applications")
    .update({ admin_mark: mark })
    .eq("id", applicationId);
  if (error) {
    if (isMissingColumn(error)) {
      return { error: "צריך להריץ קודם את ה-SQL האחרון (_jobs_crm.sql) ב-Supabase." };
    }
    return { error: "השמירה נכשלה. רענני את הדף ונסי שוב." };
  }

  revalidatePath(`/admin/jobs/${app.job_id}`);
  return { ok: true };
}

export type PipelineStatus = "interview" | "exam" | "hired" | "declined";

const PIPELINE_STATUSES: PipelineStatus[] = ["interview", "exam", "hired", "declined"];

/**
 * Move an application along the client pipeline (ראיון/מבחן/גויסה/בפעם הבאה)
 * and email the member a warm update. Hiring also celebrates on her profile —
 * found_job / hired_via_us / hired_at / workplace.
 */
/**
 * Close a job's journey — "גויס" (filled, possibly by several members) or
 * "נסגר ללא גיוס" — or reopen it. Closing also takes it off the board.
 */
export async function setJobOutcome(
  jobId: string,
  outcome: "hired" | "closed_no_hire" | "reopen"
): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  if (outcome === "reopen") {
    await admin
      .from("jobs")
      .update({ pipeline_status: "published", status: "open" })
      .eq("id", jobId);
  } else {
    await admin
      .from("jobs")
      .update({ pipeline_status: outcome, status: "closed" })
      .eq("id", jobId);
  }
  revalidatePath(`/admin/jobs/${jobId}`);
  revalidatePath("/admin/jobs");
  revalidatePath("/admin/crm");
  revalidatePath("/jobs");
}

export async function updateApplicationPipeline(
  applicationId: string,
  status: PipelineStatus
): Promise<FormState> {
  await requireRole("admin");
  if (!PIPELINE_STATUSES.includes(status)) return { error: "סטטוס לא תקין." };
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, applicant_id, job_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "ההגשה לא נמצאה." };

  const { data: job } = await admin
    .from("jobs")
    .select("title, company, pipeline_status")
    .eq("id", app.job_id)
    .maybeSingle();

  const { error } = await admin.from("applications").update({ status }).eq("id", applicationId);
  if (error) return { error: "עדכון הסטטוס נכשל. נסי שוב." };

  // The first candidate reaching an interview/exam moves the JOB to
  // "ראיונות" automatically. Hiring never auto-closes the job — a role can
  // hire several members, so that call stays with the admin.
  if (
    (status === "interview" || status === "exam") &&
    (job?.pipeline_status === "published" || job?.pipeline_status === "candidates_sent")
  ) {
    await admin.from("jobs").update({ pipeline_status: "interviews" }).eq("id", app.job_id);
  }

  // גויסה 🎉 — mark the placement on her profile so the community stats know
  // she found her job through us.
  if (status === "hired") {
    const { error: hiredError } = await admin
      .from("profiles")
      .update({
        found_job: true,
        hired_via_us: true,
        hired_at: new Date().toISOString(),
        workplace: job?.company ?? null,
      })
      .eq("id", app.applicant_id);
    if (hiredError) console.error("[pipeline] hired profile update failed:", hiredError);
  }

  // Best-effort: the warm status email must not fail the update itself.
  try {
    const [{ data: profile }, { data: authUser }] = await Promise.all([
      admin.from("profiles").select("first_name, full_name").eq("id", app.applicant_id).single(),
      admin.auth.admin.getUserById(app.applicant_id),
    ]);
    const email = authUser?.user?.email;
    if (email && job) {
      const name = profile?.first_name || profile?.full_name?.split(" ")[0] || undefined;
      const built = applicationPipelineEmail(name, job.title, status);
      const sentEmail = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
      if (!sentEmail.ok) console.error("[pipeline email] send failed:", sentEmail.error);
    }
  } catch (e) {
    console.error("[pipeline email] failed:", e);
  }

  revalidatePath(`/admin/jobs/${app.job_id}`);
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
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
          const built = applicationStatusEmail(job.title, null, status, name);
          const sent = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
          if (!sent.ok) console.error("[application email] send failed:", sent.error);
        }
      }
    } catch (e) {
      console.error("[application email] failed:", e);
    }
  }
}

// ------------------------------------------------------------- client CRM

const CRM_STATUSES: ClientCrmStatus[] = ["initial_call", "materials_sent", "job_active", "hired"];

/** Shared parse for the CRM contact fields (empty strings become null). */
function crmContactFields(formData: FormData) {
  return {
    contact_name: String(formData.get("contact_name") ?? "").trim() || null,
    contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
    contact_email: String(formData.get("contact_email") ?? "").trim() || null,
  };
}

/**
 * Add a lead to the client CRM. The lead and the portal client are the same
 * portal_clients row — credentials (username/password) are assigned later, on
 * the clients screen, once the lead reaches "משרה בטיפול".
 */
export async function createCrmLead(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");

  const company_name = String(formData.get("company_name") ?? "").trim();
  if (!company_name) return { error: "שם החברה הוא שדה חובה." };

  const { error } = await createAdminClient()
    .from("portal_clients")
    .insert({ company_name, ...crmContactFields(formData), crm_status: "initial_call" });
  if (error) {
    if (isMissingColumn(error)) {
      return { error: "צריך להריץ קודם את ה-SQL האחרון (_jobs_crm.sql) ב-Supabase." };
    }
    return { error: "לא הצלחנו להוסיף את הליד. נסי שוב." };
  }

  revalidatePath("/admin/crm");
  revalidatePath("/admin/clients");
  return { ok: true };
}

/**
 * Create a client inline from the new-job flow and hand its id back so the
 * form can select it. Born as job_active — a client created while adding a
 * job is by definition one with a job in progress.
 */
export async function quickCreateClientForJob(
  company: string,
  contactName?: string,
  contactEmail?: string
): Promise<{ id?: string; company_name?: string; error?: string }> {
  await requireRole("admin");
  const company_name = company.trim();
  if (!company_name) return { error: "שם החברה הוא שדה חובה." };

  const { data, error } = await createAdminClient()
    .from("portal_clients")
    .insert({
      company_name,
      contact_name: contactName?.trim() || null,
      contact_email: contactEmail?.trim() || null,
      crm_status: "job_active",
    })
    .select("id, company_name")
    .single();
  if (error || !data) {
    if (isMissingColumn(error)) {
      return { error: "צריך להריץ קודם את ה-SQL האחרון (_jobs_crm.sql) ב-Supabase." };
    }
    return { error: "לא הצלחנו ליצור את הלקוח. נסי שוב." };
  }

  revalidatePath("/admin/crm");
  revalidatePath("/admin/clients");
  return { id: data.id, company_name: data.company_name };
}

/** Update a CRM client's contact details, pipeline status and internal notes. */
export async function updateCrmClient(
  id: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin");

  const statusRaw = String(formData.get("crm_status") ?? "");
  if (!CRM_STATUSES.includes(statusRaw as ClientCrmStatus)) {
    return { error: "סטטוס לא תקין." };
  }

  const { error } = await createAdminClient()
    .from("portal_clients")
    .update({
      ...crmContactFields(formData),
      crm_status: statusRaw as ClientCrmStatus,
      crm_notes: String(formData.get("crm_notes") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) {
    if (isMissingColumn(error)) {
      return { error: "צריך להריץ קודם את ה-SQL האחרון (_jobs_crm.sql) ב-Supabase." };
    }
    return { error: "השמירה נכשלה. נסי שוב." };
  }

  // The clients screen shows only "משרה בטיפול" — a status change moves rows
  // between the two screens, so both must refresh.
  revalidatePath("/admin/crm");
  revalidatePath("/admin/clients");
  return { ok: true };
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
