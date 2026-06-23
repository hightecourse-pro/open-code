"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { ProfileStatus, ReportStatus, TaxonomyKind, UserRole } from "@/types/database";

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

/** Show / hide a profile question (the dynamic configuration screen). */
export async function toggleQuestionActive(id: string, active: boolean) {
  await requireRole("admin");
  const supabase = await createClient();
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

/** Post a new job to the board. */
export async function createJob(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("admin");
  const company = String(formData.get("company") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!company || !title) return { error: "חברה ותפקיד הם שדות חובה." };

  const supabase = await createClient();
  const { error } = await supabase.from("jobs").insert({
    company,
    title,
    source: String(formData.get("source") ?? "open") === "ours" ? "ours" : "open",
    location: String(formData.get("location") ?? "") || null,
    description: String(formData.get("description") ?? ""),
    tech_tags: String(formData.get("tech") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    external_url: String(formData.get("external_url") ?? "") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/jobs");
  revalidatePath("/jobs");
  return { ok: true };
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
