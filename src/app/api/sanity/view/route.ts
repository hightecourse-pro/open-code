import { NextResponse } from "next/server";
import { hallView } from "@/lib/sanity/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The hall screen's feed (public, read-only): the active event, every
 * circle's snapshot, the creations' meta. `?event=<slug>` for another run.
 * The screen polls it every two seconds.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("event");
  return NextResponse.json(await hallView(slug || null), { headers: { "cache-control": "no-store" } });
}
