// Candidates a portal client marked as favorites ("המועדפות שלי").
// Written via the service role after the portal session is verified in code.

import { createAdminClient } from "@/lib/supabase/admin";
import { loadCandidates } from "./candidates";
import { candidateSentToClient } from "./jobs";
import type { CandidateDetail } from "./types";

/**
 * The same gate the candidate page enforces: without free search, a client may
 * only touch candidates we explicitly submitted to one of her jobs. Favorites
 * are a door into candidate data too, so they answer to it as well.
 */
async function mayReach(
  clientId: string,
  canSearch: boolean,
  profileId: string
): Promise<boolean> {
  if (canSearch) return true;
  return candidateSentToClient(clientId, profileId);
}

/** The set of profile ids this client favorited (for marking cards). */
export async function favoriteIds(clientId: string): Promise<Set<string>> {
  const { data } = await createAdminClient()
    .from("portal_favorites")
    .select("profile_id")
    .eq("client_id", clientId);
  return new Set((data ?? []).map((r) => r.profile_id));
}

/** Full candidate cards for this client's favorites (privacy-filtered). */
export async function listFavorites(
  clientId: string,
  canSearch: boolean
): Promise<CandidateDetail[]> {
  const ids = await favoriteIds(clientId);
  if (ids.size === 0) return [];
  const { candidates } = await loadCandidates();
  const mine = candidates.filter((c) => ids.has(c.id));
  if (canSearch) return mine;
  // A saved id she may no longer reach (or never could) shows nothing.
  const allowed = await Promise.all(mine.map((c) => candidateSentToClient(clientId, c.id)));
  return mine.filter((_, i) => allowed[i]);
}

/** Add or remove a favorite. Returns the resulting state. */
export async function setFavorite(
  clientId: string,
  canSearch: boolean,
  profileId: string,
  on: boolean
): Promise<boolean> {
  const admin = createAdminClient();
  if (on) {
    // Saving is a read of candidate data by another name — same gate.
    if (!(await mayReach(clientId, canSearch, profileId))) return false;
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
