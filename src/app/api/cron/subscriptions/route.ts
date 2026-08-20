import { NextResponse } from "next/server";
import { raiseAlert } from "@/lib/alerts";
import { appEnv, isProductionEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { deactivateSubscription } from "@/lib/payments/subscription";
import { processShareQueue } from "@/lib/drive-shares";

/**
 * Daily maintenance. Two jobs in one endpoint because the Hobby plan allows
 * only once-a-day crons, so we can't afford a separate schedule per task:
 *   1. Expire subscriptions past their paid period (member → paused, Drive
 *      access queued for removal).
 *   2. Action the Drive share queue (grant/revoke access). Between daily runs,
 *      the "סנכרון עכשיו" button in /admin/shares does it on demand.
 *
 * Scheduled daily in vercel.json; also callable with ?secret=CRON_SECRET.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // The schedule ships in vercel.json, so a staging deployment gets it too —
  // and this nightly run emails real people and pauses real subscriptions.
  // Outside production it reports itself and does nothing.
  if (!isProductionEnv()) {
    return NextResponse.json({ skipped: "not_production", env: appEnv() });
  }
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";

  // A few days of slack before cutting anyone off: a renewal charge that is
  // late, or a webhook that got dropped, must not strip a paying member.
  const GRACE_DAYS = 3;
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 3600 * 1000).toISOString();

  const admin = createAdminClient();
  const { data: expired, error } = await admin
    .from("subscriptions")
    .select("profile_id, current_period_end")
    // Every live state, not just 'active' — a stale 'trialing' or 'past_due'
    // row would otherwise keep access forever.
    .in("status", ["active", "trialing", "past_due"])
    .not("current_period_end", "is", null)
    .lt("current_period_end", cutoff)
    .order("current_period_end", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const ids = [...new Set((expired ?? []).map((s) => s.profile_id))];
  // The dry run reports the real backlog so a first run is never a surprise.
  if (dryRun) {
    const { count } = await admin
      .from("subscriptions")
      .select("profile_id", { count: "exact", head: true })
      .in("status", ["active", "trialing", "past_due"])
      .not("current_period_end", "is", null)
      .lt("current_period_end", cutoff);
    return NextResponse.json({ dryRun: true, graceDays: GRACE_DAYS, backlog: count ?? 0, thisRun: ids.length });
  }

  let expiredCount = 0;
  for (const profileId of ids) {
    try {
      await deactivateSubscription(profileId);
      expiredCount++;
      // A subscription that reached expiry+grace with no renewal recorded is
      // exactly the case the owner asked to SEE: either she truly stopped
      // paying, or a renewal callback never arrived while the card kept being
      // charged. Both deserve a row in the alerts center, per member.
      const { data: who } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", profileId)
        .maybeSingle();
      await raiseAlert({
        kind: "subscription_expired",
        severity: "warning",
        title: `המנוי של ${who?.full_name ?? profileId} פג בלי חידוש — הועברה להשהיה`,
        body: "לא נרשם תשלום מחדש אחרי תקופת החסד. אם היא כן חויבה בכרטיס — זה חידוש שלא דווח, וצריך לרשום אותו ידנית בדף שלה.",
        context: { profileId },
        dedupeKey: `sub-expired:${profileId}`,
      });
    } catch (e) {
      console.error("[subscriptions] expire failed:", profileId, e);
    }
  }

  // …then action the Drive share queue (grants + revocations).
  let drive;
  try {
    drive = await processShareQueue(60);
  } catch (e) {
    console.error("[subscriptions] drive sync failed:", e);
  }

  // Bounded per run; the rest are picked up by tomorrow's run.
  return NextResponse.json({
    ok: true,
    expired: expiredCount,
    remaining: ids.length - expiredCount,
    drive,
  });
}
