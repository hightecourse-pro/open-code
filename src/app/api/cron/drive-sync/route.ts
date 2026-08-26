import { NextResponse } from "next/server";
import { appEnv, isProductionEnv } from "@/lib/env";
import { checkDriveAccess } from "@/lib/drive-api";
import { processShareQueue } from "@/lib/drive-shares";

/**
 * Actions the Drive share queue: grants access to members who should have it
 * and removes it from those who shouldn't. Idempotent — anything that fails
 * is retried on the next run and stays visible in /admin/shares.
 *
 * Kept as a standalone endpoint for manual/testing use (?secret=CRON_SECRET)
 * and behind the "סנכרון עכשיו" button. The daily scheduled run lives in the
 * subscriptions cron, since Hobby allows only one cron per day.
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

  // The schedule ships in vercel.json, so a staging deployment gets it too.
  // Staging runs when an EMAIL_ALLOWLIST is set — the Drive calls themselves
  // are separately gated by driveAutomationAllowed().
  if (!isProductionEnv() && !process.env.EMAIL_ALLOWLIST) {
    return NextResponse.json({ skipped: "not_production", env: appEnv() });
  }
  // Surfaces *why* nothing happens (bad key, wrong service account, …) —
  // useful when testing the setup by hand.
  const access = await checkDriveAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, drive: access }, { status: 200 });
  }

  const result = await processShareQueue(60);
  return NextResponse.json({ ok: true, ...result });
}
