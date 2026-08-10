"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalClient } from "@/lib/portal/auth";
import { sendResendEmail } from "@/lib/email/resend";
import { clientInterviewEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/site";

/**
 * Save the client's feedback on a curated candidate — an interview mark and/or
 * a short note on the job_candidates row. Re-verifies the session and that the
 * job belongs to this client AND the candidate is actually curated on it — a
 * server action is directly POSTable, so nothing here trusts the caller.
 */
export async function saveCandidateFeedback(
  jobId: string,
  profileId: string,
  patch: { interviewMarked?: boolean; clientNote?: string }
): Promise<{ ok: boolean }> {
  const client = await getPortalClient();
  if (!client) return { ok: false };

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select("id, client_id, title")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.client_id !== client.id) return { ok: false };

  const { data: row } = await admin
    .from("job_candidates")
    .select("id, interview_marked")
    .eq("job_id", jobId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!row) return { ok: false };

  const update: { interview_marked?: boolean; client_note?: string | null } = {};
  if (typeof patch.interviewMarked === "boolean") update.interview_marked = patch.interviewMarked;
  if (typeof patch.clientNote === "string") {
    update.client_note = patch.clientNote.trim().slice(0, 2000) || null;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await admin.from("job_candidates").update(update).eq("id", row.id);
  if (error) return { ok: false };

  // A fresh interview mark is news the team wants NOW — email every admin
  // (best-effort, never blocks the client's click; only on the false→true flip).
  if (patch.interviewMarked === true && row.interview_marked !== true) {
    try {
      const { data: candidate } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", profileId)
        .maybeSingle();
      const built = clientInterviewEmail(
        client.company_name,
        candidate?.full_name || "מועמדת",
        job.title,
        `${getSiteUrl()}/admin/jobs/${jobId}?tab=review`
      );
      const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
      for (const a of admins ?? []) {
        const { data: authUser } = await admin.auth.admin.getUserById(a.id);
        const email = authUser?.user?.email;
        if (!email) continue;
        const sent = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
        if (!sent.ok) console.error("[client interview email] send failed:", sent.error);
      }
    } catch (e) {
      console.error("[client interview email] failed:", e);
    }
  }

  revalidatePath(`/portal/job/${jobId}`);
  revalidatePath(`/admin/jobs/${jobId}`);
  return { ok: true };
}
