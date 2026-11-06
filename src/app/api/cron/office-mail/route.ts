import { NextResponse } from "next/server";
import { isOfficeMailConfigured, syncOfficeMail } from "@/lib/office-mail";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const qs = new URL(req.url).searchParams.get("secret");
  const hdr = req.headers.get("authorization");
  return qs === secret || hdr === `Bearer ${secret}`;
}

/**
 * Every four hours (the owner, 6.11: ״טיימר שכל כמה שעות מעדכן מיילים חדשים במערכת״):
 * new mail in office@ → office_mail, linked to the members who wrote it.
 * Manual: ?secret=… · &full=1 (everything since 1.9.2026 again). Runs on staging too - it only reads.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isOfficeMailConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 500 });
  try {
    const full = new URL(req.url).searchParams.get("full") === "1";
    return NextResponse.json({ ok: true, ...(await syncOfficeMail({ full })) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.slice(0, 200) : "sync_failed" }, { status: 502 });
  }
}
