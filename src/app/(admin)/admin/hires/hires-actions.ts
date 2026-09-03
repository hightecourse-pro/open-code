"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { studyInfoOf } from "@/lib/admin/candidate-match";


/**
 * Every hire linked to a client hangs under a job (the owner, 3/9) — when no
 * job was chosen, she lands on the client's generic one, born hidden.
 */
async function genericJobFor(clientId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("jobs")
    .select("id")
    .eq("client_id", clientId)
    .eq("pipeline_status", "hired_direct")
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: client } = await supabase
    .from("portal_clients")
    .select("company_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return null;
  const { data: job } = await supabase
    .from("jobs")
    .insert({
      title: `משרה כללית — ${client.company_name}`,
      company: client.company_name,
      client_id: clientId,
      source: "ours",
      status: "closed",
      pipeline_status: "hired_direct",
      is_visible: false,
      description: "משרה שנוצרה אוטומטית לרישום גיוסים — אפשר לערוך את הפרטים.",
    })
    .select("id")
    .single();
  return job?.id ?? null;
}

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
  const jobTypeRaw = String(formData.get("job_type") ?? "").trim();
  const job_type = JOB_TYPES.includes(jobTypeRaw) ? jobTypeRaw : null;

  const admin = createAdminClient();
  let profile_id: string | null = null;
  if (email) {
    const { data: uid } = await admin.rpc("auth_user_id_by_email", { p_email: email });
    profile_id = (uid as string | null) ?? null;
  }

  const supabase = await createClient();
  // The company comes from the clients registry (the owner, 3/9) — the name
  // is denormalized for display, the id is the link.
  const client_id = String(formData.get("client_id") ?? "").trim() || null;
  let company: string | null = null;
  if (client_id) {
    const { data: c } = await supabase.from("portal_clients").select("company_name").eq("id", client_id).maybeSingle();
    company = c?.company_name ?? null;
  }
  const job_id = client_id ? await genericJobFor(client_id) : null;
  const { error } = await supabase
    .from("hires")
    .insert({ full_name, hired_at, created_by: me.id, email, company, client_id, job_id, job_type, profile_id, source: "external" });
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

/** Full row edit (the owner, 3/9: "אין עריכה על כל שורה"). */
export async function updateHireDetails(
  id: string,
  details: { full_name: string; email: string; client_id: string; job_type: string; hired_at: string }
): Promise<{ error?: string }> {
  await requireRole("admin");
  const full_name = details.full_name.trim().slice(0, 120);
  if (!full_name) return { error: "השם לא יכול להישאר ריק." };
  const email = details.email.trim().toLowerCase().slice(0, 200) || null;
  const client_id = details.client_id.trim() || null;
  const job_type = JOB_TYPES.includes(details.job_type) ? details.job_type : null;
  const parsed = details.hired_at ? new Date(details.hired_at) : null;
  const hired_at = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : undefined;

  const supabase = await createClient();
  const { data: current } = await supabase.from("hires").select("email, profile_id").eq("id", id).maybeSingle();

  // A new email may belong to a member — re-link on the spot.
  let profile_id = current?.profile_id ?? null;
  if (email && email !== current?.email) {
    const { data: uid } = await createAdminClient().rpc("auth_user_id_by_email", { p_email: email });
    profile_id = (uid as string | null) ?? profile_id;
  }

  let company: string | null = null;
  if (client_id) {
    const { data: c } = await supabase.from("portal_clients").select("company_name").eq("id", client_id).maybeSingle();
    company = c?.company_name ?? null;
  }

  const { data: cur } = await supabase.from("hires").select("job_id, client_id").eq("id", id).maybeSingle();
  let job_id = cur?.job_id ?? null;
  if (client_id && client_id !== cur?.client_id) job_id = await genericJobFor(client_id);
  else if (!client_id) job_id = null;

  await supabase
    .from("hires")
    .update({
      full_name,
      email,
      company,
      client_id,
      job_id,
      job_type,
      profile_id,
      ...(hired_at ? { hired_at } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidate();
  return {};
}
