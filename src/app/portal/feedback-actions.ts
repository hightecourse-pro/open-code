"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalClient } from "@/lib/portal/auth";

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
    .select("id, client_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.client_id !== client.id) return { ok: false };

  const { data: row } = await admin
    .from("job_candidates")
    .select("id")
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

  revalidatePath(`/portal/job/${jobId}`);
  return { ok: true };
}
