import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { inChunks } from "@/lib/chunk";
import { VISIT_AREAS, visitWindow, type VisitArea, type VisitRange } from "@/lib/visits";

/**
 * Who came in - per member, with name and email (the owner, 11/10: "דוח של
 * הכניסות עם שם וכתובת מייל"). Anonymous visitors have no row here by
 * definition; they are in the totals on the screen.
 */
export interface VisitingMember {
  profileId: string;
  name: string;
  email: string;
  role: string;
  subscriber: boolean;
  views: number;
  firstAt: string;
  lastAt: string;
  areas: VisitArea[];
}

export async function loadVisitingMembers(range: VisitRange): Promise<VisitingMember[]> {
  const { from, to } = visitWindow(range);
  const admin = createAdminClient();
  const { data: rows } = await admin.rpc("page_views_members", { p_from: from.toISOString(), p_to: to.toISOString() });
  if (!rows?.length) return [];
  const ids = rows.map((r) => r.profile_id);
  const [profiles, emailRows] = await Promise.all([
    inChunks<{ id: string; full_name: string; role: string; status: string; member_tier: string }>(ids, (chunk) =>
      admin.from("profiles").select("id, full_name, role, status, member_tier").in("id", chunk)
    ),
    inChunks<{ id: string; email: string | null }>(ids, (chunk) => admin.rpc("member_emails", { p_ids: chunk })),
  ]);
  const profileOf = new Map(profiles.map((p) => [p.id, p]));
  const emailOf = new Map(emailRows.map((e) => [e.id, e.email ?? ""]));
  return rows.map((r) => {
    const p = profileOf.get(r.profile_id);
    return {
      profileId: r.profile_id,
      name: p?.full_name ?? "חברה שנמחקה",
      email: emailOf.get(r.profile_id) ?? "",
      role: p?.role ?? "",
      subscriber: !!p && p.status === "active" && p.member_tier === "paid",
      views: Number(r.views),
      firstAt: r.first_at,
      lastAt: r.last_at,
      areas: String(r.areas ?? "")
        .split(",")
        .filter(Boolean) as VisitArea[],
    };
  });
}

const ROLE_HE: Record<string, string> = { junior: "חברה", mentor: "מנטורית", admin: "צוות" };
const fmt = new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

/** The CSV (Excel-friendly BOM) of the same rows. */
export function visitingMembersCsv(members: VisitingMember[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const areaLabel = new Map(VISIT_AREAS.map((a) => [a.key, a.label]));
  const head = ["שם", "מייל", "תפקיד", "מנויה", "כניסות", "כניסה אחרונה", "כניסה ראשונה בטווח", "אזורים"];
  const lines = members.map((m) =>
    [
      m.name,
      m.email,
      ROLE_HE[m.role] ?? m.role,
      m.subscriber ? "כן" : "לא",
      m.views,
      fmt.format(new Date(m.lastAt)),
      fmt.format(new Date(m.firstAt)),
      m.areas.map((a) => areaLabel.get(a) ?? a).join(" / "),
    ]
      .map(esc)
      .join(",")
  );
  return "﻿" + [head.map(esc).join(","), ...lines].join("\r\n");
}
