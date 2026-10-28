import { NextResponse } from "next/server";
import { adminView, displayView } from "@/lib/hackathon-live";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The hall screen's feed (public, read-only): the question on screen with the
 * live tally, the finals board when a challenge is on, the connected count.
 * Every call may pull the phone file - one caller per 1.5s actually does.
 * `?admin=1` adds everything the control panel needs, for an admin session only.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const wantAdmin = url.searchParams.get("admin") === "1";
  const poll = url.searchParams.get("poll") !== "0";
  if (wantAdmin) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: p } = user ? await createAdminClient().from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
    if (!p || p.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json(await adminView({ poll }), { headers: { "cache-control": "no-store" } });
  }
  return NextResponse.json(await displayView({ poll }), { headers: { "cache-control": "no-store" } });
}
