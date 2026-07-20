"use client";

import { useMemo, useState } from "react";
import { Search, X, StickyNote, UserRound, Target, Star } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MemberActions } from "@/components/patterns/member-actions";
import { MemberCrm } from "@/components/patterns/member-crm";
import { StatusPill, RoleTag } from "@/components/patterns/member-tags";
import { parseLangSkills } from "@/lib/language-skills";
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
  vip_reason: string | null;
  internal_notes: string | null;
  created_at: string;
}

/** One filterable profile parameter (built server-side from the questions). */
export interface FilterDef {
  id: string; // question id
  label: string;
  type: "choice" | "text" | "language";
  options: { value: string; label: string }[];
}

type ActiveFilter = { defId: string; values: string[]; text: string };

const STATUS_ORDER: Record<ProfileStatus, number> = { pending: 0, active: 1, paused: 2, rejected: 3 };
const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "כל הסטטוסים" },
  { value: "pending", label: "ממתינות" },
  { value: "active", label: "פעילות" },
  { value: "paused", label: "מושהות" },
  { value: "rejected", label: "נדחו" },
];

/** Does this member match one active filter? (values OR-ed within a filter) */
function matchesFilter(
  f: ActiveFilter,
  def: FilterDef,
  answer: unknown
): boolean {
  if (def.type === "text") {
    const needle = f.text.trim().toLowerCase();
    if (!needle) return true;
    const hay = Array.isArray(answer)
      ? answer.map(String).join(" ")
      : typeof answer === "string"
        ? answer
        : "";
    return hay.toLowerCase().includes(needle);
  }

  if (f.values.length === 0) return true;

  if (def.type === "language") {
    const skills = parseLangSkills(answer);
    return f.values.some((sel) => {
      const sep = sel.lastIndexOf("::");
      const lang = sel.slice(0, sep);
      const level = sel.slice(sep + 2);
      return skills.some((s) => s.lang === lang && (level === "*" || s.level === level));
    });
  }

  // Generic choice: normalize the member's answer to a string list.
  const memberVals = Array.isArray(answer)
    ? answer.map(String)
    : typeof answer === "boolean" || typeof answer === "number"
      ? [String(answer)]
      : typeof answer === "string" && answer
        ? [answer]
        : [];
  return f.values.some((sel) => memberVals.includes(sel));
}

export function MembersTable({
  members,
  filterDefs = [],
  answersByMember = {},
}: {
  members: MemberRow[];
  filterDefs?: FilterDef[];
  answersByMember?: Record<string, Record<string, unknown>>;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [vip, setVip] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [active, setActive] = useState<ActiveFilter[]>([]);

  const defOf = useMemo(() => new Map(filterDefs.map((d) => [d.id, d])), [filterDefs]);
  const available = filterDefs.filter((d) => !active.some((f) => f.defId === d.id));

  function addFilter(defId: string) {
    if (!defId || active.some((f) => f.defId === defId)) return;
    setActive((a) => [...a, { defId, values: [], text: "" }]);
  }
  function removeFilter(defId: string) {
    setActive((a) => a.filter((f) => f.defId !== defId));
  }
  function toggleValue(defId: string, value: string) {
    setActive((a) =>
      a.map((f) =>
        f.defId === defId
          ? {
              ...f,
              values: f.values.includes(value)
                ? f.values.filter((v) => v !== value)
                : [...f.values, value],
            }
          : f
      )
    );
  }
  function setFilterText(defId: string, text: string) {
    setActive((a) => a.map((f) => (f.defId === defId ? { ...f, text } : f)));
  }

  // A filter only "counts" once it has a selection / text.
  const effective = active.filter((f) => f.values.length > 0 || f.text.trim().length > 0);
  const finding = effective.length > 0;

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
        // Candidate finder: every active parameter must match (AND across
        // parameters, OR within one parameter's selections).
        for (const f of effective) {
          const def = defOf.get(f.defId);
          if (!def) continue;
          if (!matchesFilter(f, def, answersByMember[m.id]?.[f.defId])) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // VIPs get priority once results are filtered down to candidates.
        if (finding && a.is_vip !== b.is_vip) return a.is_vip ? -1 : 1;
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      });
  }, [members, q, status, vip, effective, defOf, answersByMember, finding]);

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
        {filterDefs.length > 0 && (
          <button
            type="button"
            onClick={() => setFinderOpen((o) => !o)}
            className={cn(
              "inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-md border transition-colors",
              finderOpen || finding
                ? "bg-brand-gradient text-white border-transparent"
                : "bg-white text-brand-purple border-brand-purple hover:bg-tint-purple"
            )}
          >
            <Target size={14} /> איתור מועמדות
            {finding && <span className="font-mono text-[11px]">({effective.length})</span>}
          </button>
        )}
        <span className="text-[12px] text-ink-500 ms-auto">{rows.length} תוצאות</span>
      </div>

      {/* candidate finder: filter by ANY profile parameter, multi-select */}
      {finderOpen && (
        <div className="bg-white border border-ink-200 rounded-[14px] p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-ink-700">סינון לפי פרמטר בפרופיל:</span>
            <select
              value=""
              onChange={(e) => addFilter(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-ink-300 text-sm"
            >
              <option value="">בחרי פרמטר…</option>
              {available.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            {active.length > 0 && (
              <button
                type="button"
                onClick={() => setActive([])}
                className="text-[12px] font-semibold text-ink-500 hover:text-danger ms-auto"
              >
                ניקוי הכל
              </button>
            )}
          </div>

          {active.length === 0 && (
            <p className="text-[12.5px] text-ink-500">
              בחרי פרמטר אחד או יותר — בכל פרמטר אפשר לסמן כמה ערכים. יוצגו רק חברות שעונות על כל
              הפרמטרים, כשה-VIP ⭐ בראש הרשימה.
            </p>
          )}

          {active.map((f) => {
            const def = defOf.get(f.defId);
            if (!def) return null;
            return (
              <div key={f.defId} className="border-t border-ink-100 pt-2.5 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-bold text-ink-900">{def.label}</span>
                  <button
                    type="button"
                    onClick={() => removeFilter(f.defId)}
                    aria-label={`הסרת הסינון ${def.label}`}
                    className="text-ink-400 hover:text-danger"
                  >
                    <X size={13} />
                  </button>
                </div>
                {def.type === "text" ? (
                  <input
                    value={f.text}
                    onChange={(e) => setFilterText(f.defId, e.target.value)}
                    placeholder="מכיל את הטקסט…"
                    className="max-w-xs px-3 py-1.5 rounded-md border border-ink-300 text-sm outline-none focus:border-brand-purple"
                  />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {def.options.map((o) => {
                      const on = f.values.includes(o.value);
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => toggleValue(f.defId, o.value)}
                          className={cn(
                            "text-[12px] font-semibold px-2.5 py-1 rounded-full border transition-colors",
                            on
                              ? "bg-brand-gradient text-white border-transparent"
                              : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
                          )}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
              <tr key={m.id} className={cn(finding && m.is_vip && "bg-tint-warm/30")}>
                <td className="p-2 border-b border-ink-100">
                  <div className="flex items-center gap-2">
                    <Avatar size="xs" tone={m.role === "mentor" ? "gold" : "pink"} initials={m.avatar_initials || m.full_name.slice(0, 1) || "ק"} />
                    <a
                      href={`/admin/members/${m.id}`}
                      title="לפרופיל המלא"
                      className="font-medium text-ink-900 hover:text-brand-purple hover:underline inline-flex items-center gap-1"
                    >
                      {m.full_name || "—"}
                      <UserRound size={12} className="text-ink-400" />
                    </a>
                    {m.is_vip && (
                      <span
                        title={m.vip_reason ? `VIP: ${m.vip_reason}` : "VIP"}
                        className="inline-flex items-center text-[#C9962B]"
                      >
                        <Star size={13} fill="currentColor" />
                      </span>
                    )}
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
                <td className="p-2 border-b border-ink-100">
                  <MemberCrm id={m.id} isVip={m.is_vip} vipReason={m.vip_reason} notes={m.internal_notes} />
                </td>
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
