import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A woman who applied to a job BEFORE she had an account (the team recorded
 * her email in ניהול משרות) gets her application the moment she signs in:
 * every unclaimed external_applications row matching her login email becomes
 * a real applications row — submitted_at keeps the ORIGINAL application
 * date, so "ההגשות שלי" tells the truth about when she applied.
 *
 * Runs on every (app) layout render; the common case is one indexed SELECT
 * that finds nothing. Never throws — a claim hiccup must not break the page,
 * and an unclaimed row simply tries again on the next navigation.
 */
export async function claimExternalApplications(profileId: string, email: string | null | undefined): Promise<void> {
  if (!email) return;
  try {
    const admin = createAdminClient();
    // Emails are stored lowercased by the admin action; eq (not ilike) so a
    // "_" in an address is never treated as a wildcard.
    const { data: pending } = await admin
      .from("external_applications")
      .select("id, job_id, created_at")
      .is("claimed_at", null)
      .eq("email", email.trim().toLowerCase());
    if (!pending || pending.length === 0) return;

    for (const row of pending) {
      const { error } = await admin.from("applications").upsert(
        {
          job_id: row.job_id,
          applicant_id: profileId,
          status: "submitted",
          submitted_at: row.created_at,
        },
        { onConflict: "job_id,applicant_id", ignoreDuplicates: true }
      );
      if (error) continue;
      await admin
        .from("external_applications")
        .update({ claimed_profile_id: profileId, claimed_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  } catch {
    /* next navigation retries */
  }
}
