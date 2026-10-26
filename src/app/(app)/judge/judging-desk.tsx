"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JudgingEntry } from "@/lib/judging";
import { CHALLENGES } from "@/app/hackathon-2026/shared";
import { JudgingEntryCard } from "./judging-board";

/**
 * The judge's desk (the owner, 23/10: "ממשק הבדיקה צריך להיות נח ומאפשר לדפדף
 * בנוחות בין הפרויקטים"; 26/10 evening: "צריך למלא את רוחב המסך עם דפדוף נח
 * למעלה"): one project at a time, the whole width. A sticky bar at the top
 * carries the paging - previous / next, a picker of every project grouped by
 * challenge (scored ones ticked), the position and the progress - and the
 * arrow keys page too.
 */
export function JudgingDesk({ entries, viewerId, manage }: { entries: JudgingEntry[]; viewerId: string; manage: boolean }) {
  // Start on the first project she has not scored yet.
  const [index, setIndex] = useState(() => {
    const i = entries.findIndex((e) => !e.mine);
    return i >= 0 ? i : 0;
  });
  const safeIndex = Math.min(index, Math.max(0, entries.length - 1));
  const current = entries[safeIndex];
  const groups = useMemo(() => {
    const by = new Map<string, JudgingEntry[]>();
    for (const e of entries) by.set(e.submission.challengeKey, [...(by.get(e.submission.challengeKey) ?? []), e]);
    return [...by.entries()];
  }, [entries]);
  const scored = entries.filter((e) => e.mine).length;

  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      // RTL: the "next" arrow points left.
      if (ev.key === "ArrowLeft") setIndex((i) => Math.min(i + 1, entries.length - 1));
      if (ev.key === "ArrowRight") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entries.length]);

  // A new project opens at the top of the page, under the bar.
  useEffect(() => {
    if (typeof window !== "undefined" && window.scrollY > 240) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [safeIndex]);

  if (entries.length === 0 || !current) {
    return <p className="bg-white border border-ink-200 rounded-[18px] p-5 text-ink-500 text-sm shadow-sm">עדיין אין הגשות לשיפוט באתגרים שלך. הלוח יתמלא ברגע שצוות ילחץ ״הגשה סופית״.</p>;
  }
  const teamName = (e: JudgingEntry) => e.submission.members.map((m) => m.name).join(" + ");
  const btn = "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold text-ink-800 bg-white border border-ink-200 hover:border-brand-purple/60 hover:text-brand-purple disabled:opacity-40 disabled:hover:border-ink-200 disabled:hover:text-ink-800";
  const prev = (
    <button type="button" onClick={() => setIndex(Math.max(safeIndex - 1, 0))} disabled={safeIndex === 0} className={btn} data-testid="judge-prev">
      <ChevronRight size={16} /> הקודמת
    </button>
  );
  const next = (
    <button type="button" onClick={() => setIndex(Math.min(safeIndex + 1, entries.length - 1))} disabled={safeIndex === entries.length - 1} className={btn} data-testid="judge-next">
      הבאה <ChevronLeft size={16} />
    </button>
  );
  return (
    <div className="flex flex-col gap-3">
      {/* the paging bar - sticky, so it is there however far she scrolled in a long project */}
      <div className="sticky top-0 z-30 -mx-2 px-2 py-2 bg-ink-50/95 backdrop-blur supports-[backdrop-filter]:bg-ink-50/80" data-testid="judge-bar">
        <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm px-3 py-2 flex items-center gap-2 flex-wrap">
          {prev}
          <label className="flex-1 min-w-[220px] flex items-center gap-2">
            <span className="sr-only">בחירת פרויקט</span>
            <select
              value={current.submission.teamKey}
              onChange={(ev) => {
                const i = entries.findIndex((e) => e.submission.teamKey === ev.target.value);
                if (i >= 0) setIndex(i);
              }}
              className="w-full text-[13.5px] font-semibold text-ink-900 bg-ink-50 border border-ink-200 rounded-[12px] px-3 py-1.5 focus:border-brand-purple outline-none"
              data-testid="judge-picker"
            >
              {groups.map(([key, items]) => {
                const c = CHALLENGES.find((x) => x.key === key);
                return (
                  <optgroup key={key} label={`${c?.emoji ?? ""} ${c?.short ?? key} · ${items.length}`}>
                    {items.map((e) => (
                      <option key={e.submission.teamKey} value={e.submission.teamKey} data-testid="judge-rail-item" data-team={e.submission.teamKey} data-scored={e.mine ? "1" : undefined}>
                        {e.mine ? `✓ ${teamName(e)} · ${e.mine.total}` : teamName(e)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </label>
          {next}
          <span className="text-[12.5px] text-ink-600 whitespace-nowrap" data-testid="judge-position">
            {safeIndex + 1} / {entries.length} · <b className="text-ink-900">{teamName(current)}</b>
          </span>
          <span className="ms-auto flex items-center gap-2 text-[12px] text-ink-600 whitespace-nowrap" data-testid="judge-rail">
            נשפטו <b className="text-ink-900">{scored} / {entries.length}</b>
            <span className="h-1.5 w-24 rounded-full bg-ink-100 overflow-hidden inline-block">
              <span className="block h-full bg-brand-gradient" style={{ width: `${entries.length ? Math.round((scored / entries.length) * 100) : 0}%` }} />
            </span>
          </span>
        </div>
      </div>

      <div className={cn("min-w-0 flex flex-col gap-3")}>
        <JudgingEntryCard key={current.submission.teamKey} e={current} viewerId={viewerId} manage={manage} />
        <div className="flex items-center justify-between gap-2">
          {prev}
          <span className="text-[11.5px] text-ink-400 text-center">מקשי החצים במקלדת מדפדפים בין הפרויקטים.</span>
          {next}
        </div>
      </div>
    </div>
  );
}
