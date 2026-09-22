import { cookies } from "next/headers";
import type { Coordinator } from "@/lib/coordinators";

/**
 * The seminary this multi-seminary coordinator is currently viewing - her
 * cookie choice when valid, else her first institution. A single-seminary
 * coordinator always gets that one.
 */
export async function activeInstitution(me: Coordinator): Promise<string> {
  if (me.institutions.length <= 1) return me.institutions[0] ?? "";
  const jar = await cookies();
  const chosen = jar.get("oc_coord_inst")?.value;
  return chosen && me.institutions.includes(chosen) ? chosen : me.institutions[0];
}
