import { NextResponse } from "next/server";
import { SanityError, saveTablet, tabletBootstrap } from "@/lib/sanity/server";
import type { TabletSave } from "@/lib/sanity/shared";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The tablet of one circle. The token in the address is the only key: a
 * device that has it reads the circle's saved game (GET) and saves every
 * change of it (POST). No session, no cookie - a tablet opens the address and
 * plays; a replacement device opens the same address and continues.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return NextResponse.json(await tabletBootstrap(token), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const status = e instanceof SanityError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let body: TabletSave;
  try {
    body = (await req.json()) as TabletSave;
  } catch {
    return NextResponse.json({ ok: false, error: "גוף הבקשה אינו JSON" }, { status: 400 });
  }
  try {
    const r = await saveTablet(token, body);
    const status = r.ok ? 200 : "stale" in r ? 409 : 400;
    return NextResponse.json(r, { status, headers: { "cache-control": "no-store" } });
  } catch (e) {
    const status = e instanceof SanityError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status });
  }
}
