"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Avatar, Badge, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { setGraduateYear } from "../actions";

export interface GraduateRow {
  id: string;
  name: string;
  initials: string;
  spec: string | null;
  inst: string;
  instLabel: string;
  /** Canonical year value ("5786"), "" = unknown. */
  year: string;
  /** תשפ"ו, or "לא ידוע". */
  yearLabel: string;
  /** What is actually stored - shown to the coordinator when it is not a year. */
  yearRaw: string;
  cert: string;
  certLabel: string;
  working: boolean;
  subscriber: boolean;
  review: { c: number | null; t: number | null; hasAny: boolean } | null;
}

export interface YearOption {
  value: string;
  label: string;
}

const ALL = "__all";
const NONE = "";

/**
 * Year chips + name search instead of one endless list (the owner, 15/9).
 * Since 22/9: Hebrew years only (תשפ"ו), newest first, "הכל" to see everyone,
 * a year tag on every graduate that the coordinator can correct, and a מנויה
 * badge.
 */
export function GraduatesBrowser({
  rows: initialRows,
  multiInstitution,
  yearOptions,
}: {
  rows: GraduateRow[];
  multiInstitution: boolean;
  /** Every selectable year, newest first - for the correction control. */
  yearOptions: YearOption[];
}) {
  const [rows, setRows] = useState(initialRows);
  // Years present, newest first ("5786" > "5785"); the unknown bucket last.
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return b.localeCompare(a);
  });
  const insts = [...new Set(rows.map((r) => r.inst))];

  const [inst, setInst] = useState("all");
  const [year, setYear] = useState<string>(years[0] ?? ALL);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const needle = q.trim().toLowerCase();
  const searching = needle.length > 0;

  const byInst = rows.filter((r) => inst === "all" || r.inst === inst);
  const shown = byInst.filter((r) =>
    searching ? r.name.toLowerCase().includes(needle) : year === ALL || r.year === year
  );
  const showYearOnRow = searching || year === ALL;

  const certsShown = new Set(shown.map((r) => r.cert));
  const splitByCert = certsShown.size > 1;
  const yearCount = (y: string) => byInst.filter((r) => r.year === y).length;
  const labelOfYear = (y: string) => (y ? (yearOptions.find((o) => o.value === y)?.label ?? y) : "לא ידוע");

  function changeYear(g: GraduateRow, value: string) {
    setError(null);
    start(async () => {
      const res = await setGraduateYear(g.id, value);
      if (res.error) {
        setError(res.error);
        return;
      }
      setRows((list) =>
        list.map((r) => (r.id === g.id ? { ...r, year: value, yearLabel: labelOfYear(value), yearRaw: value } : r))
      );
      setEditing(null);
    });
  }

  const Row = ({ g }: { g: GraduateRow }) => (
    <div className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-b-0 hover:bg-tint-purple/30 rounded-md px-2 -mx-2 transition-colors">
      <Link href={`/coordinator/member/${g.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar size="sm" initials={g.initials} />
        <span className="flex-1 min-w-0">
          <span className="font-medium text-ink-900 truncate block leading-tight">
            {g.name}
            {g.subscriber && (
              <span className="ms-1.5 align-middle inline-block bg-tint-purple text-brand-purple px-1.5 py-px rounded-full text-[10px] font-bold">
                מנויה 💜
              </span>
            )}
          </span>
          <span className="block text-[11px] text-ink-500 truncate">
            {[g.spec, multiInstitution && inst === "all" ? g.instLabel : null].filter(Boolean).join(" · ")}
          </span>
        </span>
      </Link>
      {/* The year tag - always visible, one click to correct (the owner, 22/9). */}
      {editing === g.id ? (
        <select
          autoFocus
          defaultValue={g.year}
          disabled={pending}
          onChange={(e) => changeYear(g, e.target.value)}
          onBlur={() => setEditing(null)}
          aria-label={`שנת סיום של ${g.name}`}
          className="text-[11.5px] border border-brand-purple rounded-md px-1.5 py-0.5 bg-white"
        >
          <option value="">לא ידוע</option>
          {yearOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(g.id)}
          title={g.year ? "לחיצה לתיקון שנת הסיום" : `לא זוהתה שנה${g.yearRaw ? ` (נכתב: "${g.yearRaw}")` : ""} - לחיצה לבחירה`}
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-bold border whitespace-nowrap cursor-pointer transition-colors",
            g.year
              ? showYearOnRow
                ? "bg-tint-purple text-brand-purple border-[#DDC9EC] hover:border-brand-purple"
                : "bg-ink-50 text-ink-500 border-ink-200 hover:border-brand-purple"
              : "bg-tint-warm text-[#8C5E0E] border-[#F8D98C] hover:border-[#E5A93C]"
          )}
        >
          {g.year ? g.yearLabel : "שנה? ✎"}
        </button>
      )}
      {g.working && <Badge variant="mint">עובדת 🎉</Badge>}
      <Link href={`/coordinator/member/${g.id}`} className="shrink-0">
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
    </div>
  );

  const grouped = (list: GraduateRow[]) => {
    if (!splitByCert) return <div>{list.map((g) => <Row key={g.id} g={g} />)}</div>;
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

  const heading = searching
    ? `תוצאות חיפוש (${shown.length})`
    : year === ALL
      ? `כל הבוגרות · ${shown.length}`
      : `${labelOfYear(year)} · ${shown.length} בוגרות`;

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
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="שנת סיום">
            {[{ v: ALL, l: `הכל (${byInst.length})` }, ...years.map((y) => ({ v: y, l: `${labelOfYear(y)} (${yearCount(y)})` }))].map((o) => (
              <button
                key={o.v || "none"}
                type="button"
                role="tab"
                aria-selected={year === o.v}
                onClick={() => setYear(o.v)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-semibold border transition-colors cursor-pointer",
                  year === o.v
                    ? "bg-tint-purple text-brand-purple border-brand-purple"
                    : o.v === NONE
                      ? "bg-tint-warm text-[#8C5E0E] border-[#F8D98C] hover:border-[#E5A93C]"
                      : "bg-ink-0 text-ink-600 border-ink-200 hover:border-brand-purple/50"
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm">
        <h2 className="font-display text-[15px] font-bold text-ink-1000 mb-1">{heading}</h2>
        <p className="text-[12px] text-ink-500 mb-1.5">
          לחיצה על בוגרת פותחת את הפרופיל ואת חוות הדעת · לחיצה על תג השנה מתקנת אותה.
        </p>
        {error && <p className="text-[12px] text-danger font-semibold mb-1">{error}</p>}
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
