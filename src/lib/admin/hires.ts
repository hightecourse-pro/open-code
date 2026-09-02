import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The hires registry (the owner, 3/9): a community row appears the moment a
 * member is marked as placed-by-us — from the admin member page or from a job
 * pipeline reaching "גויסה". Fire-and-forget: a registry hiccup must never
 * fail the marking itself.
 */
export async function recordCommunityHire(profileId: string, hiredAtIso?: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: p } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", profileId)
      .maybeSingle();
    if (!p) return;
    // One row per placement — a re-mark inside half a year is the same hire,
    // a new mark long after is honestly a new job.
    const windowIso = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await admin
      .from("hires")
      .select("id")
      .eq("profile_id", profileId)
      .eq("source", "community")
      .gte("hired_at", windowIso)
      .limit(1);
    if (existing?.length) return;
    await admin.from("hires").insert({
      profile_id: profileId,
      full_name: p.full_name,
      source: "community",
      ...(hiredAtIso ? { hired_at: hiredAtIso } : {}),
    });
  } catch (e) {
    console.error("[hires] record failed:", e);
  }
}

/**
 * Un-marking a placement removes its registry row — but only while nothing
 * financial happened on it (still "started", no amount). A billed hire stays;
 * the team deletes it deliberately from /admin/hires if needed.
 */
export async function removeCommunityHireIfUnbilled(profileId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from("hires")
      .delete()
      .eq("profile_id", profileId)
      .eq("source", "community")
      .eq("status", "started")
      .is("amount", null);
  } catch (e) {
    console.error("[hires] remove failed:", e);
  }
}
