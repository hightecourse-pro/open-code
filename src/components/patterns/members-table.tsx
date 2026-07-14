"use client";

import { useMemo, useState } from "react";
import { Search, X, StickyNote } from "lucide-react";
import { Avatar } from "@/components/ui";
import { MemberActions } from "@/components/patterns/member-actions";
import { MemberCrm } from "@/components/patterns/member-crm";
import { StatusPill, RoleTag } from "@/components/patterns/member-tags";
import type { ProfileStatus, UserRole } from "@/types/database";

export interface MemberRow {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  role: UserRole;
  status: ProfileStatus;
  specialization: string | null;
  region: string | null;
  is_vip: boolean;
  internal_notes: string | null;
  created_at: string;
}

const STATUS_ORDER: Record<ProfileStatus, number> = { pending: 0, active: 1, paused: 2, rejected: 3 };
const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "כל הסטטוסים" },
  { value: "pending", label: "ממתינות" },
  { value: "active", label: "פעילות" },
  { value: "paused", label: "מושהות" },
  { value: "rejected", label: "נדחו" },
];

export function MembersTable({ members }: { members: MemberRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [vip, setVip] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return members
      .filter((m) => {
        if (status && m.status !== status) return false;
        if (vip && !m.is_vip) return false;
        if (needle) {
          const hay = `${m.full_name} ${m.specialization ?? ""} ${m.region ?? ""}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [members, q, status, vip]);

  return (
    <div className="flex flex-col gap-4">
      {/* instant search / filter */}
      <div className="bg-white border border-ink-200 rounded-md p-3 flex flex-wrap gap-2 items-center shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-ink-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי שם / תחום / אזור…"
            className="w-full ps-9 pe-8 py-2 rounded-md border border-ink-300 text-sm outline-none focus:border-brand-purple"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="ניקוי חיפוש"
              className="absolute top-1/2 -translate-y-1/2 end-2 text-ink-400 hover:text-ink-700"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 rounded-md border border-ink-300 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 text-sm text-ink-700 px-2">
          <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} /> VIP בלבד
        </label>
        <span className="text-[12px] text-ink-500 ms-auto">{rows.length} תוצאות</span>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["חברה", "תחום", "אזור", "הצטרפה", "תפקיד", "סטטוס", "CRM", "פעולות"].map((h) => (
                <th key={h} className="text-right p-2 text-[11px] text-ink-500 uppercase font-semibold border-b border-ink-200">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="p-2 border-b border-ink-100">
                  <div className="flex items-center gap-2">
                    <Avatar size="xs" tone={m.role === "mentor" ? "gold" : "pink"} initials={m.avatar_initials || m.full_name.slice(0, 1) || "ק"} />
                    <span className="font-medium text-ink-900">{m.full_name || "—"}</span>
                    {m.is_vip && <span title="VIP">⭐</span>}
                    {m.internal_notes && m.internal_notes.trim() && (
                      <span
                        title={m.internal_notes}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-purple bg-tint-purple border border-[#DDC9EC] px-1.5 py-0.5 rounded-full"
                      >
                        <StickyNote size={11} /> הערה
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-2 border-b border-ink-100 text-ink-700">{m.specialization || "—"}</td>
                <td className="p-2 border-b border-ink-100 text-ink-700">{m.region || "—"}</td>
                <td className="p-2 border-b border-ink-100 text-ink-500 whitespace-nowrap">
                  {new Date(m.created_at).toLocaleDateString("he-IL")}
                </td>
                <td className="p-2 border-b border-ink-100"><RoleTag role={m.role} /></td>
                <td className="p-2 border-b border-ink-100"><StatusPill status={m.status} /></td>
                <td className="p-2 border-b border-ink-100"><MemberCrm id={m.id} isVip={m.is_vip} notes={m.internal_notes} /></td>
                <td className="p-2 border-b border-ink-100"><MemberActions profileId={m.id} status={m.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-ink-500">לא נמצאו חברות בסינון הזה.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
