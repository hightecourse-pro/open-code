"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { studyInfoOf } from "@/lib/admin/candidate-match";

export type HireFormState = { error?: string; ok?: boolean };

const JOB_TYPES = ["practicum_placement", "temp", "immediate"];
const STATUSES = ["started", "invoice_sent", "paid"];

function revalidate() {
  revalidatePath("/admin/hires");
  revalidatePath("/forum"); // the celebration banner
}

/** Off-community placement — kept exactly like the old banner-only flow. */
export async function addExternalHire(_prev: HireFormState, formData: FormData): Promise<HireFormState> {
  const me = await requireRole("admin");

  const full_name = String(formData.get("full_name") ?? "").trim().slice(0, 120);
  if (!full_name) return { error: "כתבי את השם המלא." };
  const dateRaw = String(formData.get("hired_at") ?? "").trim();
  const parsed = dateRaw ? new Date(dateRaw) : new Date();
  const hired_at = (Number.isNaN(parsed.getTime()) ? new Date() : parsed).toISOString();
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200) || null;
  const company = String(formData.get("company") ?? "").trim().slice(0, 200) || null;
  const jobTypeRaw = String(formData.get("job_type") ?? "").trim();
  const job_type = JOB_TYPES.includes(jobTypeRaw) ? jobTypeRaw : null;

  const admin = createAdminClient();
  let profile_id: string | null = null;
  if (email) {
    const { data: uid } = await admin.rpc("auth_user_id_by_email", { p_email: email });
    profile_id = (uid as string | null) ?? null;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("hires")
    .insert({ full_name, hired_at, created_by: me.id, email, company, job_type, profile_id, source: "external" });
  if (error) return { error: "לא הצלחנו להוסיף כרגע. נסי שוב." };

  revalidate();
  return { ok: true };
}

export async function deleteHire(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("hires").delete().eq("id", id);
  revalidate();
}

export async function setHireStatus(id: string, status: string): Promise<void> {
  await requireRole("admin");
  if (!STATUSES.includes(status)) return;
  const supabase = await createClient();
  await supabase.from("hires").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  revalidate();
}

export async function setHireAmount(id: string, amountRaw: string): Promise<void> {
  await requireRole("admin");
  const cleaned = amountRaw.replace(/[^\d.]/g, "");
  const amount = cleaned ? Number(cleaned) : null;
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return;
  const supabase = await createClient();
  await supabase.from("hires").update({ amount, updated_at: new Date().toISOString() }).eq("id", id);
  revalidate();
}

/**
 * Who pays for this placement. When the study institution is chosen and the
 * hire is a community member, her institution comes from her own profile
 * (the owner, 3/9: "הוא יילקח מהפרופיל של הבת").
 */
export async function setHirePayer(id: string, payer: string): Promise<{ institution?: string | null }> {
  await requireRole("admin");
  if (!["institution", "member", ""].includes(payer)) return {};
  const supabase = await createClient();

  let payer_institution: string | null = null;
  if (payer === "institution") {
    const { data: hire } = await supabase.from("hires").select("profile_id").eq("id", id).maybeSingle();
    if (hire?.profile_id) {
      const info = await studyInfoOf([hire.profile_id]);
      payer_institution = info.get(hire.profile_id)?.studyPlace ?? null;
    }
  }

  await supabase
    .from("hires")
    .update({ payer: payer || null, payer_institution, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidate();
  return { institution: payer_institution };
}

/** Manual institution name — for external hires with no profile to read from. */
export async function setHireInstitution(id: string, name: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("hires")
    .update({ payer_institution: name.trim().slice(0, 200) || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidate();
}
