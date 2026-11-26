import { NextResponse } from "next/server";
import { getProfile, hasHcAccess } from "@/lib/auth";
import { cleanAnswers, clearAnswers, saveAnswers, touchResults } from "@/lib/hc-touch";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

/** The LED screen's feed: counts per question and answer. Public - there is nothing personal in it. */
export async function GET() {
  try {
    return NextResponse.json(await touchResults(), { headers: noStore });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500, headers: noStore });
  }
}

/** The kiosk's door: `{items: [{sid, q, a}]}` - anonymous, a random session id per run. */
export async function POST(req: Request) {
  let body: { items?: unknown } = {};
  try {
    body = (await req.json()) as { items?: unknown };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const items = cleanAnswers(body.items);
  if (!items.length) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    await saveAnswers(items);
    return NextResponse.json({ ok: true, saved: items.length }, { headers: noStore });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

/** Empties the answers (after the trial runs, before the doors open): Hightecourse managers or the team's checks. */
export async function DELETE(req: Request) {
  const secret = process.env.CRON_SECRET;
  const byCheck = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!byCheck && !hasHcAccess(await getProfile().catch(() => null))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await clearAnswers();
  return NextResponse.json({ ok: true }, { headers: noStore });
}
