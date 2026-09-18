"use client";

import { Check, Info, Lightbulb, TriangleAlert, X } from "lucide-react";
import { ProgressRing } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { CvAnalysis } from "@/lib/ai/cv";

const INSIGHT_STYLE = {
  good: { icon: Check, cls: "bg-tint-mint text-success", label: "חוזק" },
  warn: {
    icon: TriangleAlert,
    cls: "bg-tint-warm text-[#8C5E0E]",
    label: "לשיפור",
  },
  bad: { icon: X, cls: "bg-danger-bg text-danger", label: "חשוב" },
  tip: {
    icon: Lightbulb,
    cls: "bg-tint-purple text-brand-purple",
    label: "טיפ",
  },
} as const;

/**
 * ONE rendering for an AI CV review — the fresh result, the latest saved
 * review and an opened history entry all look the same (a member, 18/9: the
 * feedback "showed only under previous checks" and the job fit "gave only a
 * score"). The job block leads with what is missing for THIS job and the
 * AI's advice on what to change.
 */
export function CvResultView({
  analysis,
  heading,
  compact = false,
  showScore = true,
}: {
  analysis: CvAnalysis;
  heading?: React.ReactNode;
  compact?: boolean;
  /** The history row already prints score + summary — skip the card there. */
  showScore?: boolean;
}) {
  const rawFit = analysis.job_fit;
  const fit = rawFit ? { ...rawFit, matched: rawFit.matched ?? [], missing: rawFit.missing ?? [] } : null;
  return (
    <div className={cn("flex flex-col", compact ? "gap-2.5" : "gap-4")}>
      {heading}
      {showScore && (
        <div
          className={cn(
            "bg-white border border-ink-200 rounded-[18px] shadow-sm flex gap-5 items-center",
            compact ? "p-4" : "p-6",
          )}
        >
          <ProgressRing value={analysis.score} size={compact ? 72 : 96} />
          <div>
            <div className="font-display font-bold text-lg text-ink-1000">
              הציון שלך: {analysis.score}/100
            </div>
            <p className="t-body-sm text-ink-700 mt-1">{analysis.summary}</p>
          </div>
        </div>
      )}

      {fit && (
        <div
          className={cn(
            "bg-white border-2 border-[#DDC9EC] rounded-[18px] shadow-sm",
            compact ? "p-4" : "p-6",
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <Info size={18} className="text-brand-purple" />
            <h3 className="font-display font-bold text-ink-1000">
              התאמה למשרה: {fit.score}/100
            </h3>
          </div>
          {fit.advice && (
            <p className="t-body-sm text-ink-800 mb-3 leading-relaxed">
              {fit.advice}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-brand-pink-deep mb-1.5">
                מה חסר לך למשרה הזו
              </div>
              {fit.missing.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {fit.missing.map((m) => (
                    <li
                      key={m}
                      className="text-[13px] text-ink-900 flex gap-1.5"
                    >
                      <span className="text-brand-pink-deep shrink-0">•</span>
                      {m}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-ink-500">
                  לא זוהה פער מהותי מול דרישות המשרה 💜
                </p>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-success mb-1.5">
                מה שכבר מתאים ✓
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fit.matched.map((m) => (
                  <span
                    key={m}
                    className="bg-tint-mint text-success text-xs px-2.5 py-1 rounded-full"
                  >
                    {m}
                  </span>
                ))}
                {fit.matched.length === 0 && (
                  <span className="text-[12.5px] text-ink-500">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {(analysis.insights ?? []).map((ins, i) => {
          const s = INSIGHT_STYLE[ins.type] ?? INSIGHT_STYLE.tip;
          const Icon = s.icon;
          return (
            <div
              key={i}
              className={cn(
                "bg-white border border-ink-200 rounded-md flex gap-3 items-start",
                compact ? "p-3" : "p-4",
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                  s.cls,
                )}
              >
                <Icon size={15} />
              </div>
              <div>
                <div className="font-display font-bold text-ink-1000 text-[15px]">
                  {ins.title}
                </div>
                <p className="t-body-sm text-ink-700 mt-0.5">{ins.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
