"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface CourseStatRow {
  id: string;
  title: string;
  /** All-time sign-ups, swapped-back ones included (the owner, 31/8). */
  enrollments: number;
  /** Who holds the course right now — expands under the row (the owner, 31/8). */
  current: { profileId: string; name: string; since: string; completed: boolean }[];
  studied: number;
  avgRating: number | null;
  members: number;
  views: number;
  last: string | null;
  /** The course's member feedback — expands under the row (the owner, 30/8). */
  feedback: { profileId: string; name: string; rating: number | null; text: string | null }[];
}

export interface SessionStatRow {
  id: string;
  title: string;
  scheduledAt: string;
  openToAll: boolean;
  members: number;
  views: number;
  last: string | null;
}

const DMY = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});
const dmy = (iso: string | null | undefined) => (iso ? DMY.format(new Date(iso)) : "—");

type Col<T> = {
  key: string;
  label: string;
  value: (r: T) => string | number | null;
  render?: (r: T) => React.ReactNode;
};

/** Click-to-sort table; default column and direction come from the caller. */
function SortableTable<T extends { id: string }>({
  cols,
  rows,
  defaultKey,
  openDetailId,
  renderDetail,
}: {
  cols: Col<T>[];
  rows: T[];
  defaultKey: string;
  /** When set, that row renders renderDetail() in a full-width row below it. */
  openDetailId?: string | null;
  renderDetail?: (r: T) => React.ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: defaultKey, dir: -1 });
  const sorted = useMemo(() => {
    const col = cols.find((c) => c.key === sort.key) ?? cols[0];
    return [...rows].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (typeof va === "number" || typeof vb === "number") {
        return sort.dir * ((Number(va) || 0) - (Number(vb) || 0));
      }
      return sort.dir * String(va ?? "").localeCompare(String(vb ?? ""), "he");
    });
  }, [rows, cols, sort]);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-ink-500 text-xs text-right border-b border-ink-100">
          {cols.map((c) => (
            <th
              key={c.key}
              onClick={() =>
                setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: -1 }))
              }
              className={cn(
                "py-2 font-semibold cursor-pointer select-none hover:text-brand-purple whitespace-nowrap",
                sort.key === c.key && "text-brand-purple"
              )}
              title="לחיצה ממיינת לפי העמודה"
            >
              {c.label}
              {sort.key === c.key && <span className="ms-0.5">{sort.dir === -1 ? "↓" : "↑"}</span>}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <FragmentRow
            key={r.id}
            r={r}
            cols={cols}
            open={openDetailId === r.id}
            renderDetail={renderDetail}
          />
        ))}
      </tbody>
    </table>
  );
}

function FragmentRow<T extends { id: string }>({
  r,
  cols,
  open,
  renderDetail,
}: {
  r: T;
  cols: Col<T>[];
  open: boolean;
  renderDetail?: (r: T) => React.ReactNode;
}) {
  return (
    <>
      <tr className="border-b border-ink-100 last:border-b-0">
        {cols.map((c) => (
          <td key={c.key} className="py-2.5 first:font-medium first:text-ink-900 text-ink-700 tabular-nums">
            {c.render ? c.render(r) : (c.value(r) ?? "—")}
          </td>
        ))}
      </tr>
      {open && renderDetail && (
        <tr className="border-b border-ink-100">
          <td colSpan={cols.length} className="py-3">
            {renderDetail(r)}
          </td>
        </tr>
      )}
    </>
  );
}

export function CoursesStatsTable({ rows }: { rows: CourseStatRow[] }) {
  // One detail panel per row, opened either from "רשומות כרגע" (the names) or
  // from "דירוג ומשובים" (the feedback) — it shows whichever section was asked.
  const [openDetail, setOpenDetail] = useState<{ id: string; kind: "current" | "feedback" } | null>(null);
  const toggle = (id: string, kind: "current" | "feedback") =>
    setOpenDetail((v) => (v?.id === id && v.kind === kind ? null : { id, kind }));
  return (
    <SortableTable
      rows={rows}
      defaultKey="views"
      openDetailId={openDetail?.id ?? null}
      renderDetail={(r) =>
        openDetail?.kind === "current" ? (
          r.current.length === 0 ? null : (
            <div className="rounded-[12px] border border-ink-100 bg-ink-50/50 p-3.5">
              <div className="text-xs text-ink-500 font-semibold mb-2">
                רשומות לקורס כרגע ({r.current.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.current.map((m) => (
                  <a
                    key={m.profileId}
                    href={`/admin/members/${m.profileId}`}
                    className="bg-white border border-ink-200 rounded-full px-3 py-1 text-[12.5px] text-ink-900 hover:text-brand-purple hover:border-brand-purple transition-colors"
                    title={`בקורס מאז ${dmy(m.since)}`}
                  >
                    {m.name}
                    {m.completed && <span className="text-ink-400"> · סיימה ✓</span>}
                  </a>
                ))}
              </div>
            </div>
          )
        ) : r.feedback.length === 0 ? null : (
          <div className="rounded-[12px] border border-ink-100 bg-ink-50/50 p-3.5 flex flex-col gap-2">
            {r.feedback.map((f, i) => (
              <div key={i} className="bg-white border border-ink-100 rounded-md px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <a
                    href={`/admin/members/${f.profileId}`}
                    className="font-semibold text-ink-900 hover:text-brand-purple hover:underline"
                  >
                    {f.name}
                  </a>
                  {f.rating != null && <span>{"⭐".repeat(f.rating)}</span>}
                </div>
                {f.text && <p className="text-sm text-ink-900 mt-0.5">{f.text}</p>}
              </div>
            ))}
          </div>
        )
      }
      cols={[
        { key: "title", label: "קורס", value: (r) => r.title },
        {
          key: "current",
          label: "רשומות כרגע",
          value: (r) => r.current.length,
          render: (r) =>
            r.current.length > 0 ? (
              <button
                type="button"
                onClick={() => toggle(r.id, "current")}
                className="font-semibold text-brand-purple hover:underline cursor-pointer"
                title="פתיחת רשימת הרשומות לקורס"
              >
                {r.current.length} ▾
              </button>
            ) : (
              "—"
            ),
        },
        { key: "enrollments", label: "נרשמו עד היום", value: (r) => r.enrollments },
        { key: "studied", label: "סיימו", value: (r) => r.studied },
        {
          key: "avgRating",
          label: "דירוג ומשובים",
          value: (r) => r.avgRating ?? 0,
          render: (r) =>
            r.feedback.length > 0 ? (
              <button
                type="button"
                onClick={() => toggle(r.id, "feedback")}
                className="font-semibold text-brand-purple hover:underline cursor-pointer"
                title="פתיחת המשובים של הקורס"
              >
                {r.avgRating != null ? `${r.avgRating.toFixed(1)} ⭐` : "—"} ·{" "}
                {r.feedback.length === 1 ? "משוב אחד" : `${r.feedback.length} משובים`} ▾
              </button>
            ) : r.avgRating != null ? (
              `${r.avgRating.toFixed(1)} ⭐`
            ) : (
              "—"
            ),
        },
        { key: "members", label: "כמה חברות", value: (r) => r.members, render: (r) => r.members || "—" },
        { key: "views", label: "סה״כ כניסות", value: (r) => r.views },
        { key: "last", label: "כניסה אחרונה", value: (r) => r.last ?? "", render: (r) => dmy(r.last) },
      ]}
    />
  );
}

export function SessionsStatsTable({ rows }: { rows: SessionStatRow[] }) {
  return (
    <SortableTable
      rows={rows}
      defaultKey="views"
      cols={[
        { key: "title", label: "סשן", value: (r) => r.title },
        { key: "scheduledAt", label: "תאריך הסשן", value: (r) => r.scheduledAt, render: (r) => dmy(r.scheduledAt) },
        { key: "members", label: "כמה חברות נכנסו", value: (r) => r.members },
        { key: "views", label: "סה״כ כניסות", value: (r) => r.views },
        { key: "last", label: "כניסה אחרונה", value: (r) => r.last ?? "", render: (r) => dmy(r.last) },
        { key: "openToAll", label: "פתוח לכולן", value: (r) => (r.openToAll ? 1 : 0), render: (r) => (r.openToAll ? "כן" : "—") },
      ]}
    />
  );
}
