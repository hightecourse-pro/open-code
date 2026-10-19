import { NextResponse } from "next/server";
import { arenaDigestEmail } from "@/lib/email/templates";
import { emailBlockedByOptOut, withUnsubscribe } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * A look at a rendered mail exactly as it goes out, footer and all (the team,
 * and the checks): /api/email-preview?secret=<CRON_SECRET>&to=<address>.
 * With &gate=1 it answers instead whether a non-essential mail to that
 * address would be stopped by her opt-out.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  if (!secret || url.searchParams.get("secret") !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const to = url.searchParams.get("to") ?? "";
  if (url.searchParams.get("gate") === "1") {
    return NextResponse.json({ to, blocked: to ? await emailBlockedByOptOut(to) : false });
  }
  const mail = arenaDigestEmail("דוגמא", { titles: ["שאלה לדוגמה"], open: 1, stale: 0, arenaPoints: 10, totalScore: 25, url: `${url.origin}/arena` });
  return new NextResponse(withUnsubscribe(mail.html, to || null), { headers: { "content-type": "text/html; charset=utf-8" } });
}
