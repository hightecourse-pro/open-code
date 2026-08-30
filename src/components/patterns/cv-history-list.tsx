"use client";

import { useState } from "react";
import { Check, ChevronDown, FileText, Info, Lightbulb, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CvHistoryEntry {
  id: string;
  createdAt: string;
  score: number | null;
  summary: string | null;
  docName: string | null;
  /** Signed URL to the exact file this check ran on (snapshot or saved doc). */
  fileUrl: string | null;
  insights: { type: "good" | "warn" | "bad" | "tip"; title: string; detail: string }[];
  jobFit: { score: number; matched: string[]; missing: string[] } | null;
}

const STYLE = {
  good: { icon: Check, cls: "bg-tint-mint text-[#1B7A4B]" },
  warn: { icon: TriangleAlert, cls: "bg-tint-warm text-[#8C5E0E]" },
  bad: { icon: X, cls: "bg-danger-bg text-[#A8254B]" },
  tip: { icon: Lightbulb, cls: "bg-tint-purple text-brand-purple" },
} as const;

const HIST_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Jerusalem",
});

/**
 * Past AI reviews, each OPENABLE to its full feedback (the owner, 30/8:
 * "לא ניתן לפתוח את המשוב") — the stored insights render exactly like a
 * fresh result.
 */
export function CvHistoryList({ entries }: { entries: CvHistoryEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (entries.length === 0) return null;
  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
      <h2 className="font-display text-base font-bold text-ink-1000 mb-3">הבדיקות הקודמות שלך</h2>
      <div className="flex flex-col">
        {entries.map((r) => {
          const open = openId === r.id;
          return (
            <div key={r.id} className="border-b border-ink-100 last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : r.id)}
                aria-expanded={open}
                className="w-full py-2.5 flex items-start gap-3 flex-wrap text-start cursor-pointer group"
              >
                <span className="w-10 h-10 rounded-full bg-brand-gradient-soft flex items-center justify-center font-display font-black text-[14px] text-brand-purple shrink-0">
                  {r.score ?? "—"}
                </span>
                <span className="flex-1 min-w-[200px]">
                  <span className="text-[12.5px] text-ink-500 flex items-center gap-2 flex-wrap">
                    <span suppressHydrationWarning>{HIST_DATE.format(new Date(r.createdAt))}</span>
                    <span>·</span>
                    <span className={cn(r.docName ? "font-semibold text-brand-purple" : "text-ink-400")}>
                      {r.docName ?? "קובץ שהועלה ישירות"}
                    </span>
                  </span>
                  {r.summary && (
                    <span className={cn("block text-[13px] text-ink-900 mt-0.5", !open && "line-clamp-2")}>
                      {r.summary}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={16}
                  className={cn("shrink-0 mt-2 text-ink-400 group-hover:text-brand-purple transition-transform", open && "rotate-180")}
                />
              </button>

              {open && (
                <div className="pb-3 flex flex-col gap-2">
                  {r.fileUrl && (
                    <a
                      href={r.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="self-start inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-purple bg-tint-purple border border-[#DDC9EC] rounded-md px-3 py-1.5 hover:bg-tint-indigo"
                    >
                      <FileText size={13} /> צפייה בקובץ שנבדק
                    </a>
                  )}
                  {r.insights.map((ins, i) => {
                    const s = STYLE[ins.type] ?? STYLE.tip;
                    const Icon = s.icon;
                    return (
                      <div key={i} className="bg-ink-50/60 border border-ink-100 rounded-md p-3 flex gap-2.5 items-start">
                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", s.cls)}>
                          <Icon size={13} />
                        </span>
                        <span>
                          <span className="block text-[13px] font-bold text-ink-1000">{ins.title}</span>
                          <span className="block text-[12.5px] text-ink-700">{ins.detail}</span>
                        </span>
                      </div>
                    );
                  })}
                  {r.jobFit && (
                    <div className="bg-tint-purple/50 border border-[#DDC9EC] rounded-md p-3 text-[12.5px] text-ink-900">
                      <b className="text-brand-purple">התאמה למשרה: {r.jobFit.score}/100.</b>{" "}
                      {r.jobFit.matched.length > 0 && <>מתאים: {r.jobFit.matched.join(", ")}. </>}
                      {r.jobFit.missing.length > 0 && <>חסר: {r.jobFit.missing.join(", ")}.</>}
                    </div>
                  )}
                  {r.insights.length === 0 && !r.jobFit && (
                    <p className="text-[12.5px] text-ink-500 flex items-center gap-1.5">
                      <Info size={13} /> לבדיקה הזו לא נשמרו תובנות מפורטות.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
