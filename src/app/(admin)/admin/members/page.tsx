import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui";
import { MemberActions } from "@/components/patterns/member-actions";
import { MemberCrm } from "@/components/patterns/member-crm";
import { StatusPill, RoleTag } from "@/components/patterns/member-tags";
import type { ProfileStatus } from "@/types/database";

export const metadata: Metadata = { title: "ניהול חברות" };

const STATUS_ORDER = { pending: 0, active: 1, paused: 2, rejected: 3 } as const;
const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "כל הסטטוסים" },
  { value: "pending", label: "ממתינות" },
  { value: "active", label: "פעילות" },
  { value: "paused", label: "מושהות" },
  { value: "rejected", label: "נדחו" },
];

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; vip?: string }>;
}) {
  const { q = "", status = "", vip } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, avatar_initials, role, status, specialization, region, is_vip, internal_notes, created_at")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status as ProfileStatus);
  if (vip === "1") query = query.eq("is_vip", true);
  if (q) query = query.or(`full_name.ilike.%${q}%,specialization.ilike.%${q}%,region.ilike.%${q}%`);

  const { data: members } = await query;
  const sorted = (members ?? []).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;חברות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול חברות</h1>
        <p className="t-body-sm text-ink-500">אישור, ניהול סטטוס/תפקיד, סימון VIP והערות פנימיות.</p>
      </div>

      {/* search / filter */}
      <form method="get" className="bg-white border border-ink-200 rounded-md p-3 flex flex-wrap gap-2 items-center shadow-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="חיפוש לפי שם / תחום / אזור…"
          className="flex-1 min-w-[180px] px-3 py-2 rounded-md border border-ink-300 text-sm outline-none focus:border-brand-purple"
        />
        <select name="status" defaultValue={status} className="px-3 py-2 rounded-md border border-ink-300 text-sm">
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-sm text-ink-700 px-2">
          <input type="checkbox" name="vip" value="1" defaultChecked={vip === "1"} /> VIP בלבד
        </label>
        <button type="submit" className="bg-brand-gradient text-white text-sm font-semibold px-4 py-2 rounded-md">
          חיפוש
        </button>
      </form>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["חברה", "תחום", "אזור", "תפקיד", "סטטוס", "CRM", "פעולות"].map((h) => (
                <th key={h} className="text-right p-2 text-[11px] text-ink-500 uppercase font-semibold border-b border-ink-200">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.id}>
                <td className="p-2 border-b border-ink-100">
                  <div className="flex items-center gap-2">
                    <Avatar size="xs" tone={m.role === "mentor" ? "gold" : "pink"} initials={m.avatar_initials || m.full_name.slice(0, 1) || "ק"} />
                    <span className="font-medium text-ink-900">{m.full_name || "—"}</span>
                    {m.is_vip && <span title="VIP">⭐</span>}
                  </div>
                </td>
                <td className="p-2 border-b border-ink-100 text-ink-700">{m.specialization || "—"}</td>
                <td className="p-2 border-b border-ink-100 text-ink-700">{m.region || "—"}</td>
                <td className="p-2 border-b border-ink-100"><RoleTag role={m.role} /></td>
                <td className="p-2 border-b border-ink-100"><StatusPill status={m.status} /></td>
                <td className="p-2 border-b border-ink-100"><MemberCrm id={m.id} isVip={m.is_vip} notes={m.internal_notes} /></td>
                <td className="p-2 border-b border-ink-100"><MemberActions profileId={m.id} status={m.status} /></td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-ink-500">לא נמצאו חברות בסינון הזה.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
