import { requireRole } from "@/lib/auth";
import { VISIT_RANGES, type VisitRange } from "@/lib/visits";
import { loadVisitingMembers, visitingMembersCsv } from "@/lib/visits-report";

export const dynamic = "force-dynamic";

/** /admin/visits/export?range=7d - the visits report with names and emails, as CSV (the owner, 11/10). */
export async function GET(req: Request) {
  await requireRole("admin");
  const url = new URL(req.url);
  const raw = url.searchParams.get("range") ?? "7d";
  const range: VisitRange = VISIT_RANGES.some((r) => r.key === raw) ? (raw as VisitRange) : "7d";
  const members = await loadVisitingMembers(range);
  const csv = visitingMembersCsv(members);
  const name = `visits-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
