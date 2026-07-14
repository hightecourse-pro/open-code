"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
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

/** Resolve or dismiss a report. */
export async function updateReportStatus(id: string, status: ReportStatus) {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("reports").update({ status }).eq("id", id);
  revalidatePath("/admin/moderation");
}

/** Toggle a member's VIP flag. */
export async function toggleVip(id: string, isVip: boolean) {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("profiles").update({ is_vip: isVip }).eq("id", id);
  revalidatePath("/admin/members");
}

/** Save internal notes on a member (admin-only, for screening). */
export async function saveInternalNotes(id: string, notes: string) {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("profiles").update({ internal_notes: notes }).eq("id", id);
  revalidatePath("/admin/members");
}

/** Approve / reject / pause a member. Admin-gated (action + RLS + role check). */
export async function setMemberStatus(profileId: string, status: ProfileStatus) {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ status }).eq("id", profileId);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath("/admin/members");
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

/** Post a new job to the board. */
export async function createJob(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const f = jobFields(formData);
  const err = validateJob(f);
  if (err) return { error: err };

  const supabase = await createClient();
  const { error } = await supabase.from("jobs").insert(f);
  if (error) return { error: error.message };
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
  if (error) return { error: error.message };
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

/** Update a candidate application's status (internal-job pipeline). */
export async function setApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("applications").update({ status }).eq("id", applicationId);
  revalidatePath("/admin/jobs");
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
