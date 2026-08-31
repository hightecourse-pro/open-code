"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Search, X, StickyNote, UserRound, Target, Star, Eye } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MemberActions } from "@/components/patterns/member-actions";
import { MemberCrm } from "@/components/patterns/member-crm";
import { StatusPill, RoleTag } from "@/components/patterns/member-tags";
import { evaluateMemberFilters } from "@/app/(admin)/admin/actions";
import type { ProfileStatus, UserRole } from "@/types/database";

export interface MemberRow {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  role: UserRole;
  status: ProfileStatus;
  specialization: string | null;
  region: string | null;
  is_experienced?: boolean;
  is_vip: boolean;
  vip_reason: string | null;
  internal_notes: string | null;
  created_at: string;
  /** Contact details (the owner, 1/9): email with a copy button + phone. */
  email?: string | null;
  phone?: string | null;
  /** Splits "ממתינה" into its two honest kinds (the owner, 1/9). */
  profile_completed?: boolean;
  /** Where she studied — replaces the specialization column (the owner, 1/9). */
  study_place?: string | null;
  /** Payment state for the export — "מנוי פעיל עד…" / payers-list / "". */
  payment?: string;
}

/** The member's TYPE in words — the export's status column. */
function typeLabel(m: MemberRow): string {
  if (m.role === "admin") return "צוות";
  if (m.role === "mentor") return m.status === "active" ? "מנטורית" : m.status === "pending" ? "מנטורית לאישור" : "מנטורית (לא פעילה)";
  if (m.status === "active") return "מנויה";
  if (m.status === "pending") return m.profile_completed ? "משתתפת ללא מנוי" : "באמצע השאלון";
  if (m.status === "paused") return "מושהית";
  return "חסומה";
}

/** Copies the email and confirms with a brief ✓. */
function CopyButton({ text, title }: { text: string; title: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable — nothing to break */
        }
      }}
      className="text-ink-400 hover:text-brand-purple cursor-pointer"
    >
      {done ? <Check size={12} className="text-success" /> : <Copy size={12} />}
    </button>
  );
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

/** One-click member TYPES (the owner, 1/9) — each chip carries its count. */
const TYPE_DEFS: { id: string; label: string; test: (m: MemberRow) => boolean; onlyWhenAny?: boolean }[] = [
  { id: "subscribers", label: "מנויות 💜", test: (m) => m.role === "junior" && m.status === "active" },
  { id: "free", label: "ללא מנוי", test: (m) => m.role === "junior" && m.status === "pending" && m.profile_completed === true },
  { id: "midwizard", label: "באמצע השאלון", test: (m) => m.role === "junior" && m.status === "pending" && !m.profile_completed },
  { id: "mentors", label: "מנטוריות 👑", test: (m) => m.role === "mentor" && m.status === "active" },
  { id: "mentor-pending", label: "מנטוריות לאישור", test: (m) => m.role === "mentor" && m.status === "pending" },
  { id: "team", label: "צוות", test: (m) => m.role === "admin" },
  { id: "paused", label: "מושהות", test: (m) => m.status === "paused", onlyWhenAny: true },
  { id: "rejected", label: "חסומות", test: (m) => m.status === "rejected", onlyWhenAny: true },
];
/** Old ?status= deep links (the dashboard cubes) keep filtering raw status. */
const RAW_STATUS: Record<string, (m: MemberRow) => boolean> = {
  active: (m) => m.status === "active",
  pending: (m) => m.status === "pending",
  paused: (m) => m.status === "paused",
  rejected: (m) => m.status === "rejected",
};

/** Sortable/filterable columns — filter is a contains-match on the shown text. */
const COLUMNS: { key: string; label: string; sortVal?: (m: MemberRow) => string; filterVal?: (m: MemberRow) => string }[] = [
  { key: "name", label: "חברה", sortVal: (m) => m.full_name ?? "", filterVal: (m) => m.full_name ?? "" },
  { key: "contact", label: "קשר", sortVal: (m) => m.email ?? "", filterVal: (m) => `${m.email ?? ""} ${m.phone ?? ""}` },
  { key: "study", label: "מקום לימודים", sortVal: (m) => m.study_place ?? "", filterVal: (m) => m.study_place ?? "" },
  { key: "region", label: "אזור", sortVal: (m) => m.region ?? "", filterVal: (m) => m.region ?? "" },
  { key: "joined", label: "הצטרפה", sortVal: (m) => m.created_at },
  { key: "role", label: "תפקיד", sortVal: (m) => `${m.role}${m.is_experienced ? "-exp" : ""}` },
  { key: "status", label: "סטטוס", sortVal: (m) => `${STATUS_ORDER[m.status]}${m.profile_completed ? "b" : "a"}` },
  { key: "crm", label: "CRM" },
  { key: "actions", label: "פעולות" },
];

export function MembersTable({
  members,
  filterDefs = [],
  initialStatus = "",
}: {
  members: MemberRow[];
  filterDefs?: FilterDef[];
  /** Pre-applied status filter — the dashboard cubes deep-link with it. */
  initialStatus?: string;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [vip, setVip] = useState(false);
  // Per-column contains-filters + one active sort (click a header to toggle).
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | null>(null);
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

  // The criteria are matched on the SERVER (SQL over profile_answers) — the
  // browser no longer holds every member's every answer. Debounced per change.
  const [matchIds, setMatchIds] = useState<Set<string> | null>(null);
  const [matching, setMatching] = useState(false);
  const effectiveKey = JSON.stringify(
    effective.map((f) => ({ d: f.defId, v: [...f.values].sort(), t: f.text.trim() }))
  );
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (effectiveKey === "[]") {
        setMatchIds(null);
        setMatching(false);
        return;
      }
      setMatching(true);
      try {
        const parsed = JSON.parse(effectiveKey) as { d: string; v: string[]; t: string }[];
        const ids = await evaluateMemberFilters(
          parsed.map((f) => ({
            defId: f.d,
            type: (filterDefs.find((x) => x.id === f.d)?.type ?? "choice") as
              | "choice"
              | "text"
              | "language",
            values: f.v,
            text: f.t,
          }))
        );
        if (alive) setMatchIds(new Set(ids));
      } finally {
        if (alive) setMatching(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveKey]);

  const typeTest = useMemo(() => {
    return TYPE_DEFS.find((t) => t.id === status)?.test ?? RAW_STATUS[status] ?? (() => true);
  }, [status]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const sortDef = sort ? COLUMNS.find((c) => c.key === sort.col) : null;
    return members
      .filter((m) => {
        if (!typeTest(m)) return false;
        if (vip && !m.is_vip) return false;
        if (needle) {
          const hay = `${m.full_name} ${m.specialization ?? ""} ${m.region ?? ""} ${m.email ?? ""} ${m.phone ?? ""} ${m.study_place ?? ""}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        // Per-column contains-filters (the owner, 1/9).
        for (const c of COLUMNS) {
          const f = (colFilters[c.key] ?? "").trim().toLowerCase();
          if (f && c.filterVal && !c.filterVal(m).toLowerCase().includes(f)) return false;
        }
        // Candidate finder: the server returned the ids that match ALL the
        // active criteria; while it thinks, nothing is filtered out yet.
        if (finding && matchIds && !matchIds.has(m.id)) return false;
        return true;
      })
      .sort((a, b) => {
        // An explicit header sort wins over everything.
        if (sortDef?.sortVal) {
          return sortDef.sortVal(a).localeCompare(sortDef.sortVal(b), "he") * (sort?.dir ?? 1);
        }
        // VIPs get priority once results are filtered down to candidates.
        if (finding && a.is_vip !== b.is_vip) return a.is_vip ? -1 : 1;
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      });
  }, [members, q, typeTest, vip, matchIds, finding, colFilters, sort]);

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
        {/* Excel export (the owner, 1/9) — exactly the rows currently shown,
            so the chips/filters shape the file. UTF-8 BOM keeps Hebrew intact
            when Excel opens the CSV. */}
        <button
          type="button"
          onClick={() => {
            const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
            const header = ["שם", "טלפון", "מייל", "סמינר", "אזור", "סטטוס", "מצב תשלום", "VIP", "הצטרפה"];
            const lines = [header.map(esc).join(",")];
            for (const m of rows) {
              lines.push(
                [
                  m.full_name,
                  m.phone ?? "",
                  m.email ?? "",
                  m.study_place ?? "",
                  m.region ?? "",
                  typeLabel(m),
                  m.payment ?? "",
                  m.is_vip ? "VIP" : "",
                  new Date(m.created_at).toLocaleDateString("he-IL"),
                ]
                  .map(esc)
                  .join(",")
              );
            }
            const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `חברות-קוד-פתוח-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
          }}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-md border border-ink-300 text-ink-700 hover:border-brand-purple hover:text-brand-purple transition-colors cursor-pointer"
        >
          ⬇ יצוא לאקסל
        </button>
        <span className="text-[12px] text-ink-500 ms-auto">
          {finding && matching ? "מסננת…" : `${rows.length} תוצאות`}
        </span>
      </div>

      {/* one-click TYPE chips with live counts (the owner, 1/9) */}
      <div className="flex gap-2 flex-wrap">
        {[{ id: "", label: "הכל", test: () => true as boolean, onlyWhenAny: false }, ...TYPE_DEFS].map((t) => {
          const n = t.id === "" ? members.length : members.filter(t.test).length;
          if (t.onlyWhenAny && n === 0) return null;
          const on = status === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setStatus(t.id)}
              aria-pressed={on}
              className={
                on
                  ? "font-display font-semibold text-[12.5px] px-3 py-[6px] rounded-full bg-brand-gradient text-white"
                  : "font-display font-semibold text-[12.5px] px-3 py-[6px] rounded-full border-[1.5px] border-ink-200 bg-white text-ink-700 hover:border-brand-purple transition-colors cursor-pointer"
              }
            >
              {t.label} ({n})
            </button>
          );
        })}
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
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="text-right p-2 text-[11px] text-ink-500 uppercase font-semibold border-b border-ink-200"
                >
                  {c.sortVal ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSort((s) =>
                          s?.col === c.key
                            ? s.dir === 1
                              ? { col: c.key, dir: -1 }
                              : null
                            : { col: c.key, dir: 1 }
                        )
                      }
                      className="inline-flex items-center gap-1 uppercase font-semibold hover:text-brand-purple cursor-pointer"
                      title="מיון לפי העמודה"
                    >
                      {c.label}
                      {sort?.col === c.key ? (sort.dir === 1 ? "▲" : "▼") : ""}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
            {/* per-column contains-filters (the owner, 1/9) */}
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="p-1 border-b border-ink-200">
                  {c.filterVal && (
                    <input
                      value={colFilters[c.key] ?? ""}
                      onChange={(e) => setColFilters((f) => ({ ...f, [c.key]: e.target.value }))}
                      placeholder="סינון…"
                      aria-label={`סינון לפי ${c.label}`}
                      className="w-full min-w-[70px] px-2 py-1 rounded border border-ink-200 text-[12px] font-normal outline-none focus:border-brand-purple"
                    />
                  )}
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
                    <a
                      href={`/admin/members/${m.id}/profile`}
                      title="הפרופיל המלא — כמו שמגייסת רואה"
                      className="text-ink-400 hover:text-brand-purple"
                    >
                      <Eye size={13} />
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
                <td className="p-2 border-b border-ink-100 text-[12px] whitespace-nowrap">
                  {m.email ? (
                    <span className="inline-flex items-center gap-1 text-ink-700" dir="ltr">
                      {m.email}
                      <CopyButton text={m.email} title="העתקת המייל" />
                    </span>
                  ) : (
                    "—"
                  )}
                  {m.phone && (
                    <div className="text-ink-500" dir="ltr">
                      {m.phone}
                    </div>
                  )}
                </td>
                <td className="p-2 border-b border-ink-100 text-ink-700">{m.study_place || "—"}</td>
                <td className="p-2 border-b border-ink-100 text-ink-700">{m.region || "—"}</td>
                <td className="p-2 border-b border-ink-100 text-ink-500 whitespace-nowrap">
                  {new Date(m.created_at).toLocaleDateString("he-IL")}
                </td>
                <td className="p-2 border-b border-ink-100"><RoleTag role={m.role} experienced={m.is_experienced === true} /></td>
                <td className="p-2 border-b border-ink-100">
                  {m.status === "pending" ? (
                    // Two different waits (the owner, 1/9): mid-questionnaire
                    // vs a full member who simply has no subscription.
                    m.profile_completed ? (
                      <span className="inline-flex items-center whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full bg-tint-purple text-brand-purple">
                        משתתפת ללא מנוי
                      </span>
                    ) : (
                      <span className="inline-flex items-center whitespace-nowrap text-[11px] font-bold px-2 py-0.5 rounded-full bg-ink-100 text-ink-500">
                        באמצע השאלון
                      </span>
                    )
                  ) : (
                    <StatusPill status={m.status} />
                  )}
                </td>
                <td className="p-2 border-b border-ink-100">
                  <MemberCrm id={m.id} isVip={m.is_vip} vipReason={m.vip_reason} notes={m.internal_notes} />
                </td>
                <td className="p-2 border-b border-ink-100"><MemberActions profileId={m.id} status={m.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-ink-500">לא נמצאו חברות בסינון הזה.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
