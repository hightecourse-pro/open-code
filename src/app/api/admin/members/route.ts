import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { loadAdminMembersData } from "@/lib/admin-members-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The admin members list as JSON (15.11): the table on /admin/members fetches
 * it here, keeps the last copy in her browser and refreshes it quietly, so
 * the page itself paints at once. Admins only - the same rows the page used
 * to render; never cached by anything between her browser and this server.
 */
export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const data = await loadAdminMembersData();
  return NextResponse.json(data, { headers: { "cache-control": "private, no-store" } });
}
