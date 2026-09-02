"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

function revalidate() {
  revalidatePath("/admin/crm");
  revalidatePath("/admin/hires");
  revalidatePath("/admin/jobs");
}

/**
 * One-click job under a client (the owner, 3/9: "אפשרות קלה לייצר עוד משרה").
 * Born hidden (draft + not visible) — she edits the content on the job page
 * and publishes when it's real.
 */
export async function quickCreateJobForClient(clientId: string): Promise<{ jobId?: string; error?: string }> {
  const me = await requireRole("admin");
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("portal_clients")
    .select("id, company_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { error: "הלקוחה לא נמצאה." };

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      title: `משרה חדשה — ${client.company_name}`,
      company: client.company_name,
      client_id: client.id,
      source: "ours",
      status: "open",
      pipeline_status: "draft",
      is_visible: false,
      description: "משרה שנוצרה מהפייפליין — ערכי כאן את הפרטים.",
      posted_by: me.id,
    })
    .select("id")
    .single();
  if (error || !job) return { error: "יצירת המשרה נכשלה. נסי שוב." };
  revalidate();
  return { jobId: job.id };
}

/**
 * Move a hire under a job — or detach her (the owner, 3/9: "לגרור אליה
 * מועמדות"). The hire inherits the job's client and company name.
 */
export async function assignHireToJob(hireId: string, jobId: string | null): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  if (!jobId) {
    await supabase.from("hires").update({ job_id: null, updated_at: new Date().toISOString() }).eq("id", hireId);
  } else {
    const { data: job } = await supabase
      .from("jobs")
      .select("id, client_id, company")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) return;
    await supabase
      .from("hires")
      .update({
        job_id: job.id,
        client_id: job.client_id,
        company: job.company,
        updated_at: new Date().toISOString(),
      })
      .eq("id", hireId);
  }
  revalidate();
}
