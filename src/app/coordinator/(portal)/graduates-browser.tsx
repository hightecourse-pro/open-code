"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar, Badge, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface GraduateRow {
  id: string;
  name: string;
  initials: string;
  spec: string | null;
  inst: string;
  instLabel: string;
  year: string; // option value, "" = none
  yearLabel: string;
  cert: string;
  certLabel: string;
  working: boolean;
  review: { c: number | null; t: number | null; hasAny: boolean } | null;
}

/**
 * Year chips + name search instead of one endless list (the owner, 15/9).
 * Default view = the newest year; search looks across all years at once.
 */
export function GraduatesBrowser({
  rows,
  multiInstitution,
}: {
  rows: GraduateRow[];
  multiInstitution: boolean;
}) {
  // Years present, newest first ("5786" > "5785"); the no-year bucket last.
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return b.localeCompare(a);
  });
  const insts = [...new Set(rows.map((r) => r.inst))];

  const [inst, setInst] = useState("all");
  const [year, setYear] = useState(years[0] ?? "");
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const searching = needle.length > 0;

  const byInst = rows.filter((r) => inst === "all" || r.inst === inst);
  const shown = byInst.filter((r) =>
    searching ? r.name.toLowerCase().includes(needle) : r.year === year
  );

  // Group the visible rows: year headers only while searching (one year is
  // trivially known otherwise), certificate headers only when >1 cert shown.
  const certsShown = new Set(shown.map((r) => r.cert));
  const splitByCert = certsShown.size > 1;

  const yearCount = (y: string) => byInst.filter((r) => r.year === y).length;

  const Row = ({ g }: { g: GraduateRow }) => (
    <Link
      href={`/coordinator/member/${g.id}`}
      className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-b-0 hover:bg-tint-purple/30 rounded-md px-2 -mx-2 transition-colors"
    >
      <Avatar size="sm" initials={g.initials} />
      <span className="flex-1 min-w-0">
        <span className="font-medium text-ink-900 truncate block leading-tight">{g.name}</span>
        <span className="block text-[11px] text-ink-500 truncate">
          {[g.spec, searching ? g.yearLabel : null, multiInstitution && inst === "all" ? g.instLabel : null]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {g.working && <Badge variant="mint">עובדת 🎉</Badge>}
      {g.review?.hasAny ? (
        <span className="text-[11.5px] font-semibold text-[#8C5E0E] whitespace-nowrap">
          ⭐ {[g.review.c && `תקשורת ${g.review.c}`, g.review.t && `כישרון ${g.review.t}`]
            .filter(Boolean)
            .join(" · ") || "חוות דעת ✓"}
        </span>
      ) : (
        <span className="text-[11.5px] text-brand-purple font-semibold whitespace-nowrap">+ חוות דעת</span>
      )}
    </Link>
  );

  const grouped = (list: GraduateRow[]) => {
    if (!splitByCert)
      return <div>{list.map((g) => <Row key={g.id} g={g} />)}</div>;
    const certs = [...new Set(list.map((r) => r.cert))];
    return certs.map((c) => (
      <div key={c || "none"} className="mt-1">
        <div className="text-[11.5px] font-bold text-ink-500 mt-2">
          {c ? (list.find((r) => r.cert === c)?.certLabel ?? c) : "ללא תעודה מוגדרת"}
        </div>
        {list.filter((r) => r.cert === c).map((g) => <Row key={g.id} g={g} />)}
      </div>
    ));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="t-body-sm text-ink-500">
        מה שאת כותבת כאן - דירוגים, הערות ועדכוני תעסוקה - גלוי רק לך ולצוות קוד פתוח.
      </p>

      <div className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm flex flex-col gap-3">
        <div className="relative">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-ink-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש בוגרת בשם - בכל השנים…"
            className="pr-9"
            aria-label="חיפוש בוגרת"
          />
        </div>

        {multiInstitution && (
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: "all", l: `כל המוסדות (${rows.length})` },
              ...insts.map((i) => ({
                v: i,
                l: `${rows.find((r) => r.inst === i)?.instLabel ?? i} (${rows.filter((r) => r.inst === i).length})`,
              })),
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setInst(o.v)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-semibold border transition-colors cursor-pointer",
                  inst === o.v
                    ? "bg-brand-purple text-white border-brand-purple"
                    : "bg-ink-0 text-ink-600 border-ink-200 hover:border-brand-purple/50"
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        )}

        {!searching && (
          <div className="flex flex-wrap gap-1.5">
            {years.map((y) => (
              <button
                key={y || "none"}
                type="button"
                onClick={() => setYear(y)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-semibold border transition-colors cursor-pointer",
                  year === y
                    ? "bg-tint-purple text-brand-purple border-brand-purple"
                    : "bg-ink-0 text-ink-600 border-ink-200 hover:border-brand-purple/50"
                )}
              >
                {y ? (byInst.find((r) => r.year === y)?.yearLabel ?? y) : "ללא שנה"} ({yearCount(y)})
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm">
        <h2 className="font-display text-[15px] font-bold text-ink-1000 mb-1">
          {searching
            ? `תוצאות חיפוש (${shown.length})`
            : `${shown[0]?.yearLabel ?? (year ? year : "ללא שנת סיום")} · ${shown.length} בוגרות`}
        </h2>
        <p className="text-[12px] text-ink-500 mb-1.5">לחיצה על בוגרת פותחת את הפרופיל ואת חוות הדעת.</p>
        {grouped(shown)}
        {shown.length === 0 && (
          <p className="text-ink-500 text-sm py-3">
            {searching ? "לא נמצאה בוגרת בשם הזה." : "אין בוגרות בשנה הזו."}
          </p>
        )}
      </section>
    </div>
  );
}
