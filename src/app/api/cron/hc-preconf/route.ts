import { NextResponse } from "next/server";
import { runPrepTick } from "@/lib/hc-preconf/data";

export const dynamic = "force-dynamic";
export const maxDuration = 150;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const qs = new URL(req.url).searchParams.get("secret");
  const hdr = req.headers.get("authorization");
  return qs === secret || hdr === `Bearer ${secret}`;
}

/**
 * Every 30 minutes (pg_cron; the owner, 19/11: ״כל חצי שעה תבדוק אם יש חדשות,
 * תשלח להם מייל ותעדכן את הפרטים בגיליון החדש״): the sheet's newcomers into
 * the table, their pre-conference mail (only while the admin switch is on),
 * the mirror tab refreshed. Manual: ?secret=… · &dry=1 (no mail).
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  try {
    return NextResponse.json(await runPrepTick({ send: !dry, trigger: dry ? "cron-dry" : "cron" }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 300) : "tick_failed" }, { status: 502 });
  }
}
