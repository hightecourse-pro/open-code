"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CRITERIA, ZERO_SCORES, totalOf, type CriterionKey, type Scores } from "@/lib/judging-shared";
import { ScoreForm } from "./score-form";

/**
 * A judge the owner opened the automated review to (27/10: "תפתח לרות אפין את
 * הבחינה שלך"; "לכל מתמודדת אפשר יהיה לראות את הבחינה שלה + הבחינה של ה-AI
 * ב-2 טאבים פנימיים + טבלת השוואה"): her own exam and the AI's as two tabs,
 * and under them a table that puts the two side by side, criterion by
 * criterion. Her column follows the form as she types; the AI's column is the
 * review's suggested points.
 */
export function ExamTabs({
  teamKey,
  initial,
  notes,
  comment,
  savedAt,
  suggested,
  ai,
}: {
  teamKey: string;
  initial: Scores | null;
  notes: Partial<Record<CriterionKey, string>>;
  comment: string | null;
  savedAt: string | null;
  /** The AI's suggested points per criterion - null when the review has not run on this submission. */
  suggested: Partial<Scores> | null;
  /** The AI's exam, rendered by the server. */
  ai: ReactNode;
}) {
  const [tab, setTab] = useState<"mine" | "ai">("mine");
  const [mine, setMine] = useState<Scores>(initial ?? { ...ZERO_SCORES });
  const aiScores: Scores | null = suggested ? { ...ZERO_SCORES, ...suggested } : null;
  const mineTotal = totalOf(mine);
  const aiTotal = aiScores ? totalOf(aiScores) : null;
  const tabs: { key: "mine" | "ai"; label: string }[] = [
    { key: "mine", label: "הבחינה שלי" },
    { key: "ai", label: aiTotal ? `הבחינה של ה-AI · ${aiTotal.total}` : "הבחינה של ה-AI" },
  ];
  return (
    <div className="flex flex-col gap-4" data-testid="exam-tabs">
      <div role="tablist" aria-label="הבחינה שלי והבחינה של ה-AI" className="flex flex-wrap items-center gap-1 self-start rounded-full border border-ink-200 bg-ink-50 p-1">
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              data-testid="exam-tab"
              data-key={t.key}
              onClick={() => setTab(t.key)}
              className={cn("rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors cursor-pointer", on ? "bg-brand-gradient text-white" : "text-ink-700 hover:bg-white")}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {/* both panels stay mounted: the form keeps what she typed while she reads the AI's exam */}
      <div role="tabpanel" hidden={tab !== "mine"} data-testid="exam-panel" data-key="mine">
        <ScoreForm teamKey={teamKey} initial={initial} notes={notes} comment={comment} savedAt={savedAt} onChange={setMine} />
      </div>
      <div role="tabpanel" hidden={tab !== "ai"} data-testid="exam-panel" data-key="ai">
        {ai}
      </div>
      <Compare mine={mine} ai={aiScores} mineTotal={mineTotal} aiTotal={aiTotal} />
    </div>
  );
}

/** The comparison: one row per criterion, her points, the AI's, the gap - and the totals. */
function Compare({ mine, ai, mineTotal, aiTotal }: { mine: Scores; ai: Scores | null; mineTotal: ReturnType<typeof totalOf>; aiTotal: ReturnType<typeof totalOf> | null }) {
  const th = "px-3 py-1.5 text-[12px] font-semibold text-ink-500 text-center whitespace-nowrap";
  return (
    <div className="rounded-[14px] border border-ink-200 overflow-hidden" data-testid="exam-compare">
      <div className="px-4 py-2 bg-ink-50 text-[12.5px] font-bold text-ink-800 flex items-center gap-2 flex-wrap">
        טבלת השוואה
        <span className="font-normal text-ink-500">· הבחינה שלך מול הבחינה של ה-AI, קריטריון אחרי קריטריון</span>
        {!ai && <span className="font-normal text-[#8C5E0E]">· הבדיקה האוטומטית עוד לא רצה על ההגשה הזו</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr>
              <th className="px-4 py-1.5 text-[12px] font-semibold text-ink-500 text-start">קריטריון</th>
              <th className={th}>שלי</th>
              <th className={th}>ה-AI</th>
              <th className={th}>הפרש</th>
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((c) => {
              const m = mine[c.key];
              const a = ai ? ai[c.key] : null;
              const d = a === null ? null : m - a;
              return (
                <tr key={c.key} className="border-t border-ink-100" data-testid="exam-compare-row" data-key={c.key}>
                  <td className="px-4 py-1.5 text-ink-900">
                    {c.label} <span className="text-ink-400">/ {c.max}</span>
                  </td>
                  <td className="px-3 py-1.5 text-center font-bold text-ink-1000" data-testid="exam-mine">
                    {m}
                  </td>
                  <td className="px-3 py-1.5 text-center font-bold text-brand-purple" data-testid="exam-ai">
                    {a ?? "-"}
                  </td>
                  <td className={cn("px-3 py-1.5 text-center font-semibold", gapClass(d))} data-testid="exam-diff">
                    <Gap d={d} />
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-ink-200 bg-tint-purple/30 font-black" data-testid="exam-compare-row" data-key="total">
              <td className="px-4 py-2 text-ink-1000">
                סה״כ <span className="text-ink-400 font-normal">/ 100</span>
                {mineTotal.capped && <span className="text-[11.5px] font-semibold text-[#8C5E0E]"> · שלך מוגבל ל-60</span>}
                {aiTotal?.capped && <span className="text-[11.5px] font-semibold text-[#8C5E0E]"> · ה-AI מוגבל ל-60</span>}
              </td>
              <td className="px-3 py-2 text-center text-ink-1000" data-testid="exam-mine">
                {mineTotal.total}
              </td>
              <td className="px-3 py-2 text-center text-brand-purple" data-testid="exam-ai">
                {aiTotal?.total ?? "-"}
              </td>
              <td className={cn("px-3 py-2 text-center", gapClass(aiTotal ? mineTotal.total - aiTotal.total : null))} data-testid="exam-diff">
                <Gap d={aiTotal ? mineTotal.total - aiTotal.total : null} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** "+3" / "-2" / "=" - kept left-to-right so the sign stays in front of the number inside the Hebrew page. */
function Gap({ d }: { d: number | null }) {
  if (d === null) return <>-</>;
  if (d === 0) return <>=</>;
  return <span dir="ltr">{d > 0 ? `+${d}` : String(d)}</span>;
}

/** A gap of five points or more stands out; small ones stay quiet. */
function gapClass(d: number | null): string {
  if (d === null || d === 0) return "text-ink-500";
  return Math.abs(d) >= 5 ? "text-[#8C5E0E]" : "text-ink-800";
}
