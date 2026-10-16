import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** How often a member's stamp may move - the heartbeat is a minute, so a 30s guard is just belt and braces. */
const MIN_GAP_MS = 30_000;

/**
 * The presence heartbeat's target (the owner, 16/10): stamps
 * profiles.last_seen_at for the signed-in member, at most once per 30s.
 * Nothing in the body, nothing returned but ok. See src/lib/presence.ts.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - MIN_GAP_MS).toISOString();
  const { error } = await admin
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id)
    .or(`last_seen_at.is.null,last_seen_at.lt.${cutoff}`);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
