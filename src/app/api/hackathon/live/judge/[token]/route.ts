import { NextResponse } from "next/server";
import { judgeView, setJudgeScore, LiveError } from "@/lib/hackathon-live";

export const dynamic = "force-dynamic";

/** A judge's own view: her challenge, the finalists, her scores. The token in the link is the whole identity. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const v = await judgeView(token);
  if (!v) return NextResponse.json({ ok: false, error: "מפתח השופטת לא מוכר - בקשי מהמארגנת קישור חדש" }, { status: 404 });
  return NextResponse.json(v, { headers: { "cache-control": "no-store" } });
}

/** `{finalistId, scores: {criterionKey: 1..10}}` - saved as a whole; missing keys clear. */
export async function PUT(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let body: { finalistId?: unknown; scores?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "גוף הבקשה אינו JSON" }, { status: 400 });
  }
  const finalistId = String(body.finalistId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(finalistId)) return NextResponse.json({ ok: false, error: "חסרה סופית" }, { status: 400 });
  try {
    const r = await setJudgeScore(token, finalistId, body.scores);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof LiveError) return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    throw e;
  }
}
