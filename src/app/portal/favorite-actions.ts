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
  const state = await setFavorite(client.id, profileId, on);
  revalidatePath("/portal/favorites");
  return { ok: true, on: state };
}
