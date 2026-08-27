"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface CourseStatRow {
  id: string;
  title: string;
  enrollments: number;
  studied: number;
  avgRating: number | null;
  members: number;
  views: number;
  last: string | null;
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
}: {
  cols: Col<T>[];
  rows: T[];
  defaultKey: string;
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
          <tr key={r.id} className="border-b border-ink-100 last:border-b-0">
            {cols.map((c) => (
              <td key={c.key} className="py-2.5 first:font-medium first:text-ink-900 text-ink-700 tabular-nums">
                {c.render ? c.render(r) : (c.value(r) ?? "—")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CoursesStatsTable({ rows }: { rows: CourseStatRow[] }) {
  return (
    <SortableTable
      rows={rows}
      defaultKey="views"
      cols={[
        { key: "title", label: "קורס", value: (r) => r.title },
        { key: "enrollments", label: "נרשמו", value: (r) => r.enrollments },
        { key: "studied", label: "סיימו", value: (r) => r.studied },
        {
          key: "avgRating",
          label: "דירוג ממוצע",
          value: (r) => r.avgRating ?? 0,
          render: (r) => (r.avgRating != null ? `${r.avgRating.toFixed(1)} ⭐` : "—"),
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
