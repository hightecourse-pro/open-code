"use client";

import { useState } from "react";
import { ChevronDown, FileText, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { CvResultView } from "@/components/patterns/cv-result-view";

export interface CvHistoryEntry {
  id: string;
  createdAt: string;
  score: number | null;
  summary: string | null;
  docName: string | null;
  /** Signed URL to the exact file this check ran on (snapshot or saved doc). */
  fileUrl: string | null;
  insights: { type: "good" | "warn" | "bad" | "tip"; title: string; detail: string }[];
  jobFit: { score: number; matched: string[]; missing: string[]; advice?: string } | null;
}

const HIST_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Jerusalem",
});

/**
 * Past AI reviews, each OPENABLE to its full feedback (the owner, 30/8:
 * "לא ניתן לפתוח את המשוב") - the stored insights render exactly like a
 * fresh result.
 */
export function CvHistoryList({ entries }: { entries: CvHistoryEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (entries.length === 0) return null;
  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
      <h2 className="font-display text-base font-bold text-ink-1000 mb-1">בדיקות קודמות</h2>
      <p className="text-[12.5px] text-ink-500 mb-3">לחיצה על בדיקה פותחת את המשוב המלא שלה.</p>
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
                  {r.score ?? "-"}
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
                    <span className="block text-[13px] text-ink-900 mt-0.5">{r.summary}</span>
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
                  {(r.insights.length > 0 || r.jobFit) && (
                    <CvResultView
                      compact
                      showScore={false}
                      analysis={{ score: r.score ?? 0, summary: r.summary ?? "", insights: r.insights, job_fit: r.jobFit }}
                    />
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
