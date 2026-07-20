import { cache } from "react";
import { redirect } from "next/navigation";
import { getPortalClient, type PortalClient } from "@/lib/portal/auth";

/**
 * The shell and every page inside it need the signed-in client during the same
 * render pass; cache() collapses those into one cookie check and one read.
 */
export const portalClient = cache(getPortalClient);

/**
 * Gate for portal pages. The session is verified per page rather than in the
 * layout, because the login page lives under /portal and has no session yet.
 */
export async function requirePortalClient(): Promise<PortalClient> {
  const client = await portalClient();
  if (!client) redirect("/portal/login");
  return client;
}
