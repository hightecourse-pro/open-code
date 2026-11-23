import { NextResponse } from "next/server";
import { getProfile, hasHcAccess } from "@/lib/auth";
import { SanityError, fontObject, putFont } from "@/lib/sanity/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The game's typeface, Rag Sans (RAG Studio, licensed to the production -
 * the files stay out of the public repo, in the private `sanity` bucket).
 * Streamed from our own domain and cached for a year: a tablet fetches each
 * weight once.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const bytes = await fontObject(file);
  if (!bytes) return new Response("not found", { status: 404 });
  return new Response(bytes, { headers: { "content-type": "font/ttf", "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" } });
}

/** Putting a font file in place: the team's upload tool (the cron secret) or whoever may manage the event. The raw TTF is the body. */
export async function PUT(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const secret = process.env.CRON_SECRET;
  let ok = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!ok) ok = hasHcAccess(await getProfile().catch(() => null));
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { file } = await params;
  try {
    const bytes = Buffer.from(await req.arrayBuffer());
    await putFont(file, bytes);
    return NextResponse.json({ ok: true, file, bytes: bytes.length });
  } catch (e) {
    const status = e instanceof SanityError ? e.status : 500;
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status });
  }
}
