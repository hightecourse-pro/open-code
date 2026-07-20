import { NextResponse } from "next/server";
import { checkDriveAccess } from "@/lib/drive-api";
import { processShareQueue } from "@/lib/drive-shares";

/**
 * Actions the Drive share queue: grants access to members who should have it
 * and removes it from those who shouldn't. Idempotent — anything that fails
 * is retried on the next run and stays visible in /admin/shares.
 *
 * Scheduled in vercel.json; also callable manually with ?secret=CRON_SECRET.
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
  // Surfaces *why* nothing happens (bad key, wrong service account, …) —
  // useful when testing the setup by hand.
  const access = await checkDriveAccess();
  if (!access.ok) {
    return NextResponse.json({ ok: false, drive: access }, { status: 200 });
  }

  const result = await processShareQueue(60);
  return NextResponse.json({ ok: true, ...result });
}
