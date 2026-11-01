"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAPPED_TOTAL, CORRECTNESS_FLOOR, CRITERIA, readAutoReport, totalOf, ZERO_SCORES, type AutoCheck, type AutoReport } from "@/lib/judging-shared";
import type { MemberHackathonReview } from "@/lib/member-overview";

const WHEN = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
const DMY = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", year: "numeric" });

const CHECK_STYLE: Record<AutoCheck["status"], { icon: string; cls: string }> = {
  pass: { icon: "✓", cls: "bg-tint-mint text-success" },
  fail: { icon: "✗", cls: "bg-[#FDE8E8] text-[#B42318]" },
  warn: { icon: "!", cls: "bg-tint-warm text-[#8C5E0E]" },
  skip: { icon: "–", cls: "bg-ink-100 text-ink-500" },
};

const PILL = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12.5px] font-bold whitespace-nowrap";

/**
 * Her hackathon submission on top of the application (the owner, 1/11: ״בהגשת
 * משרה שים למעלה בצורה בולטת הגישה להאקתון עם לינק לסרטון + אפשרות לפתוח בועה
 * עם חוות הדעת המלאה של ה-AI והציון״). The strip is the loud part - the video
 * one click away; the review opens in a bubble over the page, so the answers
 * below stay where they were. Nothing here for a woman who registered but
 * never submitted.
 */
export function HackathonStrip({ h, candidateName }: { h: MemberHackathonReview; candidateName: string }) {
  if (!h.submittedAt) return null;
  return (
    <div
      className="rounded-[12px] border border-brand-pink-deep/30 bg-tint-pink px-3.5 py-2.5 flex items-center gap-x-3 gap-y-2 flex-wrap"
      data-testid="review-hackathon"
      data-team={h.teamKey}
    >
      <span className="inline-flex items-center gap-1.5 font-display text-[14px] font-bold text-ink-1000">
        <Trophy size={16} className="text-brand-pink-deep" /> הגישה להאקתון AI 2026
      </span>
      <span className="text-[12.5px] text-ink-800">
        אתגר <b>{h.challengeShort}</b> {h.challengeEmoji}
        {h.partnerName && (
          <span className="text-ink-600">
            {" "}
            · בזוג עם <b>{h.partnerName}</b>
          </span>
        )}
        <span className="text-ink-500"> · {DMY.format(new Date(h.submittedAt))}</span>
      </span>
      <span className="flex items-center gap-1.5 flex-wrap ms-auto">
        {h.videoUrl ? (
          <a
            href={h.videoUrl}
            target="_blank"
            rel="noopener"
            className={cn(PILL, "bg-brand-pink-deep text-white hover:opacity-90")}
            data-testid="review-hackathon-video"
          >
            ▶ הסרטון{h.videoKind === "drive" ? " (דרייב)" : ""} ↗
          </a>
        ) : (
          <span className="text-[12px] text-ink-500">בלי סרטון</span>
        )}
        {h.productUrl && (
          <a
            href={h.productUrl}
            target="_blank"
            rel="noopener"
            className={cn(PILL, "bg-white text-brand-purple border border-brand-purple/30 hover:bg-tint-purple")}
            data-testid="review-hackathon-product"
          >
            המערכת ↗
          </a>
        )}
        {h.report && <ReviewBubble h={h} report={h.report} candidateName={candidateName} />}
      </span>
    </div>
  );
}

/** The full automated review + the score, in a bubble over the page. Team-only, like everything on this screen. */
function ReviewBubble({ h, report, candidateName }: { h: MemberHackathonReview; report: AutoReport; candidateName: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const read = readAutoReport(report);
  const suggested = report.suggested ? totalOf({ ...ZERO_SCORES, ...report.suggested }) : null;
  const checks = report.checks ?? [];
  const passed = checks.filter((c) => c.status === "pass").length;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(PILL, "bg-brand-purple text-white hover:opacity-90 cursor-pointer")}
        data-testid="review-hackathon-ai"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Sparkles size={13} /> חוות הדעת של ה-AI{suggested ? ` · ${suggested.total}/100` : ""}
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label={`חוות הדעת של ה-AI על הפרויקט של ${candidateName}`}
            data-testid="review-hackathon-bubble"
          >
            {/* Click outside closes - the bubble floats over the screen. */}
            <button type="button" aria-label="סגירה" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink-1000/40 cursor-default" />
            <div className="relative w-full max-w-[640px] max-h-[88vh] overflow-y-auto rounded-[18px] bg-white shadow-xl border border-ink-200 p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="font-display text-[16px] font-bold text-ink-1000 flex items-center gap-1.5">
                    <Sparkles size={15} className="text-brand-purple" /> חוות הדעת של ה-AI
                  </h4>
                  <p className="text-[12px] text-ink-500">
                    הבדיקה האוטומטית של הפרויקט של {candidateName} · אתגר {h.challengeShort} {h.challengeEmoji}
                    {h.reportRanAt ? ` · רצה ${WHEN.format(new Date(h.reportRanAt))}` : ""}
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="סגירה" className="shrink-0 text-ink-500 hover:text-ink-900 cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              {suggested && (
                <div
                  className={cn("rounded-[14px] px-4 py-3 flex items-baseline gap-3 flex-wrap", read.blocked ? "bg-[#FDE8E8]" : "bg-tint-purple/40")}
                  data-testid="review-hackathon-total"
                >
                  <span className="font-display text-[32px] font-black leading-none text-ink-1000 tabular-nums">{suggested.total}</span>
                  <span className="text-[13px] text-ink-600">מתוך 100</span>
                  {suggested.capped && (
                    <span className="text-[12px] font-semibold text-[#B42318]">
                      מוגבל ל-{CAPPED_TOTAL}: נכונות מתחת ל-{CORRECTNESS_FLOOR} (הסכום הגולמי {suggested.raw})
                    </span>
                  )}
                </div>
              )}
              {read.blocked && (
                <div className="rounded-[12px] border border-[#F2BBC8] bg-[#FDE8E8] px-3 py-2 text-[13px] text-[#A8254B]">
                  <b>חסום:</b> {read.blocked}
                </div>
              )}
              {report.suggested && (
                <div className="text-[13px] flex flex-col" data-testid="review-hackathon-criteria">
                  {CRITERIA.filter((c) => report.suggested?.[c.key] !== undefined).map((c) => {
                    const v = report.suggested?.[c.key] ?? 0;
                    const ratio = v / c.max;
                    return (
                      <div key={c.key} className="border-t border-ink-100 py-1.5 min-w-0" data-testid="review-hackathon-criterion">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-ink-900">{c.label}</span>
                          <span
                            className={cn(
                              "inline-block rounded-md px-1.5 py-0.5 font-bold tabular-nums",
                              ratio >= 0.8 ? "bg-tint-mint text-success" : ratio >= 0.5 ? "bg-tint-warm text-[#8C5E0E]" : "bg-[#FDE8E8] text-[#B42318]"
                            )}
                          >
                            {v}/{c.max}
                          </span>
                        </div>
                        <div className="text-ink-700 leading-relaxed break-words">{read.notes[c.key] ?? <span className="text-ink-400">-</span>}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {read.videoNote && (
                <div className="text-[12.5px] text-ink-700 leading-relaxed">
                  <b className="text-ink-900">סרטון:</b> {read.videoNote}
                </div>
              )}
              {read.bottomLine && (
                <p className="text-[13px] text-ink-900 leading-relaxed bg-tint-purple/30 rounded-[12px] px-3 py-2" data-testid="review-hackathon-bottom-line">
                  <b>השורה התחתונה:</b> {read.bottomLine}
                </p>
              )}
              {!report.suggested && report.summary && (
                <p className="text-[13px] text-ink-800 leading-relaxed bg-tint-purple/30 rounded-[12px] px-3 py-2 whitespace-pre-wrap">{report.summary}</p>
              )}
              {checks.length > 0 && (
                <details className="group text-[12.5px]">
                  <summary className="list-none cursor-pointer text-ink-600 font-semibold [&::-webkit-details-marker]:hidden">
                    הבדיקות שרצו: {passed}/{checks.length} עברו <span className="text-ink-400 group-open:rotate-90 inline-block transition-transform">›</span>
                  </summary>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {checks.map((c) => {
                      const st = CHECK_STYLE[c.status] ?? CHECK_STYLE.skip;
                      return (
                        <li key={c.key} className="flex items-start gap-2">
                          <span className={cn("shrink-0 mt-0.5 h-[18px] w-[18px] rounded-full inline-flex items-center justify-center text-[11px] font-black", st.cls)}>{st.icon}</span>
                          <span>
                            <b className="text-ink-900">{c.label}</b>
                            {c.detail && <span className="text-ink-600"> · {c.detail}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-ink-100">
                {h.videoUrl && (
                  <a href={h.videoUrl} target="_blank" rel="noopener" className={cn(PILL, "bg-brand-pink-deep text-white hover:opacity-90")}>
                    ▶ הסרטון ↗
                  </a>
                )}
                {h.productUrl && (
                  <a href={h.productUrl} target="_blank" rel="noopener" className={cn(PILL, "bg-white text-brand-purple border border-brand-purple/30 hover:bg-tint-purple")}>
                    המערכת ↗
                  </a>
                )}
                <span className="text-[11.5px] text-ink-500 ms-auto">פנימי לצוות - לא נחשף ללקוח ולא למועמדת</span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
