import { NextResponse } from "next/server";
import { getProfile, hasHcAccess } from "@/lib/auth";
import { listTextEdits, putTextEdit } from "@/lib/sanity/server";

export const dynamic = "force-dynamic";

/** The game's edit mode (the owner, 26.11) and Claude's own reads: whoever may manage Hightecourse, or the cron secret. */
async function allowed(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const profile = await getProfile().catch(() => null);
  return hasHcAccess(profile);
}

export async function GET(req: Request) {
  if (!(await allowed(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ rows: await listTextEdits() }, { headers: { "cache-control": "no-store" } });
}

/** {kind: text|screen|note, key, text|null, original?, screen?} - a null text removes the row. */
export async function POST(req: Request) {
  if (!(await allowed(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let body: { kind?: unknown; key?: unknown; text?: unknown; original?: unknown; screen?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "גוף הבקשה אינו JSON" }, { status: 400 });
  }
  const kind = String(body.kind ?? "");
  const key = String(body.key ?? "").slice(0, 300);
  if (!["text", "screen", "note"].includes(kind) || !key) return NextResponse.json({ ok: false, error: "חסר סוג או מפתח" }, { status: 400 });
  await putTextEdit({
    kind: kind as "text" | "screen" | "note",
    key,
    text: body.text == null ? null : String(body.text).slice(0, 4000),
    original: body.original == null ? null : String(body.original).slice(0, 4000),
    screen: body.screen == null ? null : String(body.screen).slice(0, 80),
  });
  return NextResponse.json({ ok: true });
}
