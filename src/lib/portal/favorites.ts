// Candidates a portal client marked as favorites ("המועדפות שלי").
// Written via the service role after the portal session is verified in code.

import { createAdminClient } from "@/lib/supabase/admin";
import { loadCandidates } from "./candidates";
import type { CandidateDetail } from "./types";

/** The set of profile ids this client favorited (for marking cards). */
export async function favoriteIds(clientId: string): Promise<Set<string>> {
  const { data } = await createAdminClient()
    .from("portal_favorites")
    .select("profile_id")
    .eq("client_id", clientId);
  return new Set((data ?? []).map((r) => r.profile_id));
}

/** Full candidate cards for this client's favorites (privacy-filtered). */
export async function listFavorites(clientId: string): Promise<CandidateDetail[]> {
  const ids = await favoriteIds(clientId);
  if (ids.size === 0) return [];
  const { candidates } = await loadCandidates();
  return candidates.filter((c) => ids.has(c.id));
}

/** Add or remove a favorite. Returns the resulting state. */
export async function setFavorite(
  clientId: string,
  profileId: string,
  on: boolean
): Promise<boolean> {
  const admin = createAdminClient();
  if (on) {
    await admin
      .from("portal_favorites")
      .upsert({ client_id: clientId, profile_id: profileId }, { onConflict: "client_id,profile_id" });
    return true;
  }
  await admin
    .from("portal_favorites")
    .delete()
    .eq("client_id", clientId)
    .eq("profile_id", profileId);
  return false;
}
