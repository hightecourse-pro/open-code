import { NextResponse } from "next/server";
import { LiveError, registerJudge } from "@/lib/hackathon-live";

export const dynamic = "force-dynamic";

/**
 * The judges' entrance (the owner, 26/10): `{name, challengeKey, code}` - the
 * judge's name and challenge as typed on her phone, plus the judges' code from
 * the control panel. The same name on the same challenge continues the same
 * scores (a refresh, a second device).
 */
export async function POST(req: Request) {
  let body: { name?: unknown; challengeKey?: unknown; code?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "גוף הבקשה אינו JSON" }, { status: 400 });
  }
  try {
    const r = await registerJudge({ name: String(body.name ?? ""), challengeKey: String(body.challengeKey ?? ""), code: String(body.code ?? "") });
    return NextResponse.json({ ok: true, token: r.token, name: r.name });
  } catch (e) {
    if (e instanceof LiveError) return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    throw e;
  }
}
