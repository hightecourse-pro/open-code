"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JudgingEntry } from "@/lib/judging";
import { CHALLENGES } from "@/app/hackathon-2026/shared";
import { JudgingEntryCard } from "./judging-board";

/**
 * The judge's desk (the owner, 23/10: "ממשק הבדיקה צריך להיות נח ומאפשר לדפדף
 * בנוחות בין הפרויקטים"): one project at a time - its video in the page, the
 * links, what the team wrote and the score form - with a rail of every project
 * (scored ones ticked), previous/next buttons and the arrow keys.
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
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      // RTL: the "next" arrow points left.
      if (ev.key === "ArrowLeft") setIndex((i) => Math.min(i + 1, entries.length - 1));
      if (ev.key === "ArrowRight") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entries.length]);

  if (entries.length === 0 || !current) {
    return <p className="bg-white border border-ink-200 rounded-[18px] p-5 text-ink-500 text-sm shadow-sm">עדיין אין הגשות לשיפוט באתגרים שלך. הלוח יתמלא ברגע שצוות ילחץ ״הגשה סופית״.</p>;
  }
  const teamName = (e: JudgingEntry) => e.submission.members.map((m) => m.name).join(" + ");
  const nav = (
    <div className="flex items-center gap-2 bg-white border border-ink-200 rounded-full px-2 py-1.5 shadow-sm">
      <button
        type="button"
        onClick={() => setIndex(Math.max(safeIndex - 1, 0))}
        disabled={safeIndex === 0}
        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-bold text-ink-700 hover:bg-ink-100 disabled:opacity-40"
        data-testid="judge-prev"
      >
        <ChevronRight size={15} /> הקודמת
      </button>
      <span className="mx-auto text-[12.5px] text-ink-600 truncate" data-testid="judge-position">
        {safeIndex + 1} / {entries.length} · <b className="text-ink-900">{teamName(current)}</b>
      </span>
      <button
        type="button"
        onClick={() => setIndex(Math.min(safeIndex + 1, entries.length - 1))}
        disabled={safeIndex === entries.length - 1}
        className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-bold text-ink-700 hover:bg-ink-100 disabled:opacity-40"
        data-testid="judge-next"
      >
        הבאה <ChevronLeft size={15} />
      </button>
    </div>
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start">
      <aside className="lg:sticky lg:top-4 bg-white border border-ink-200 rounded-[18px] shadow-sm overflow-hidden flex flex-col max-h-[78vh]" data-testid="judge-rail">
        <div className="px-3.5 py-2.5 border-b border-ink-100">
          <div className="flex items-center justify-between text-[12px] text-ink-600">
            <span>נשפטו</span>
            <b className="text-ink-900">
              {scored} / {entries.length}
            </b>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-ink-100 overflow-hidden">
            <div className="h-full bg-brand-gradient" style={{ width: `${entries.length ? Math.round((scored / entries.length) * 100) : 0}%` }} />
          </div>
        </div>
        <div className="overflow-y-auto">
          {groups.map(([key, items]) => {
            const c = CHALLENGES.find((x) => x.key === key);
            return (
              <div key={key}>
                <div className="px-3.5 py-1.5 text-[11.5px] font-bold text-ink-500 bg-ink-50/70 border-y border-ink-100">
                  {c?.emoji} {c?.short ?? key} · {items.length}
                </div>
                {items.map((e) => {
                  const i = entries.indexOf(e);
                  const active = i === safeIndex;
                  return (
                    <button
                      key={e.submission.teamKey}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-current={active ? "true" : undefined}
                      data-testid="judge-rail-item"
                      data-team={e.submission.teamKey}
                      data-scored={e.mine ? "1" : undefined}
                      className={cn(
                        "w-full text-start flex items-center gap-2 px-3.5 py-2 text-[12.5px] border-b border-ink-100 last:border-b-0 transition-colors",
                        active ? "bg-tint-purple text-brand-purple font-bold" : "text-ink-800 hover:bg-ink-50"
                      )}
                    >
                      <span className={cn("shrink-0 h-4 w-4 rounded-full inline-flex items-center justify-center text-[10px]", e.mine ? "bg-tint-mint text-success" : "bg-ink-100 text-ink-400")} aria-label={e.mine ? "נשפטה" : "עוד לא"}>
                        {e.mine ? <Check size={11} /> : ""}
                      </span>
                      <span className="truncate">{teamName(e)}</span>
                      {e.mine && <span className="ms-auto text-[11px] text-ink-500 shrink-0">{e.mine.total}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>
      <div className="min-w-0 flex flex-col gap-3">
        {nav}
        <JudgingEntryCard key={current.submission.teamKey} e={current} viewerId={viewerId} manage={manage} sideBySideFrom="xl" />
        {nav}
        <p className="text-[11.5px] text-ink-400 text-center">מקשי החצים במקלדת מדפדפים בין הפרויקטים.</p>
      </div>
    </div>
  );
}
