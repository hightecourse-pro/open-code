"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

export interface SessionViewer {
  profileId: string;
  name: string;
  opens: number;
  last: string | null;
}

/**
 * Who entered ONE session's recording (the owner, 31/8: "גם בסשנים, מי
 * נכנסה"). Loaded lazily per click — the aggregated content_open_stats view
 * keeps this a handful of rows per session instead of shipping member×content
 * history to the page (the 29/8 scale rule).
 */
export async function sessionViewers(sessionId: string): Promise<SessionViewer[]> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: stats } = await supabase
    .from("content_open_stats")
    .select("profile_id, opens, last_open")
    .eq("owner_type", "session")
    .eq("owner_id", sessionId)
    .order("last_open", { ascending: false })
    .limit(2000);
  if (!stats?.length) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", [...new Set(stats.map((s) => s.profile_id))]);
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return stats.map((s) => ({
    profileId: s.profile_id,
    name: nameOf.get(s.profile_id) ?? "חברת קהילה",
    opens: Number(s.opens),
    last: s.last_open,
  }));
}
