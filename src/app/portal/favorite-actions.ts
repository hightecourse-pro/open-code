"use server";

import { revalidatePath } from "next/cache";
import { getPortalClient } from "@/lib/portal/auth";
import { setFavorite } from "@/lib/portal/favorites";

/** Toggle a candidate in this client's favorites. Re-checks the session — a
 * server action is directly POSTable. */
export async function toggleFavorite(
  profileId: string,
  on: boolean
): Promise<{ ok: boolean; on: boolean }> {
  const client = await getPortalClient();
  if (!client) return { ok: false, on: !on };
  // setFavorite re-checks that this client may reach the candidate at all —
  // a direct POST with someone else's id must change nothing.
  const state = await setFavorite(client.id, client.can_search, profileId, on);
  revalidatePath("/portal/favorites");
  return { ok: state === on, on: state };
}
