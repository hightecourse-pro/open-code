"use client";

import { useActionState, useMemo, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { CAPPED_TOTAL, CORRECTNESS_FLOOR, CRITERIA, ZERO_SCORES, totalOf, type CriterionKey, type Scores } from "@/lib/judging-shared";
import { saveScore, type ScoreState } from "./actions";

/** The rubric as a form: seven sliders-as-numbers with a live total, a line per criterion. */
export function ScoreForm({ teamKey, initial, notes, comment, savedAt }: { teamKey: string; initial: Scores | null; notes: Partial<Record<CriterionKey, string>>; comment: string | null; savedAt: string | null }) {
  const [state, action, pending] = useActionState<ScoreState, FormData>(saveScore.bind(null, teamKey), {});
  const [values, setValues] = useState<Scores>(initial ?? { ...ZERO_SCORES });
  const t = useMemo(() => totalOf(values), [values]);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
        {CRITERIA.map((c) => (
          <div key={c.key} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <label htmlFor={`${teamKey}-${c.key}`} className="text-[13px] font-semibold text-ink-900 flex-1">
                {c.label} <span className="text-ink-400 font-normal">/ {c.max}</span>
              </label>
              <input
                id={`${teamKey}-${c.key}`}
                name={c.key}
                type="number"
                min={0}
                max={c.max}
                step={1}
                value={values[c.key]}
                onChange={(e) => setValues((v) => ({ ...v, [c.key]: Math.max(0, Math.min(c.max, Number(e.target.value) || 0)) }))}
                className="w-16 text-center text-[14px] font-bold border border-ink-300 rounded-md px-2 py-1 focus:border-brand-purple outline-none"
              />
            </div>
            <input
              type="range"
              min={0}
              max={c.max}
              step={1}
              value={values[c.key]}
              onChange={(e) => setValues((v) => ({ ...v, [c.key]: Number(e.target.value) }))}
              aria-label={c.label}
              className="w-full accent-[#7C3AED]"
            />
            <span className="text-[11.5px] text-ink-500">{c.hint}</span>
            <input
              name={`note_${c.key}`}
              defaultValue={notes[c.key] ?? ""}
              maxLength={600}
              placeholder="משפט אחד לצוות (אופציונלי)"
              className="text-[12.5px] border border-ink-200 rounded-md px-2.5 py-1.5 focus:border-brand-purple outline-none"
            />
          </div>
        ))}
      </div>
      <textarea
        name="comment"
        defaultValue={comment ?? ""}
        maxLength={2000}
        rows={2}
        placeholder="הערה כללית על הפרויקט (אופציונלי) - מה בלט, מה חסר, למה הציון"
        className="text-[12.5px] border border-ink-200 rounded-md px-2.5 py-1.5 focus:border-brand-purple outline-none resize-y"
        data-testid="score-comment"
      />
      <div className="flex items-center gap-3 flex-wrap rounded-[14px] bg-tint-purple/40 px-4 py-2.5">
        <span className="font-display font-black text-[20px] text-ink-1000">
          {t.total} <span className="text-[13px] font-bold text-ink-500">/ 100</span>
        </span>
        {t.capped && (
          <span className="text-[12.5px] font-semibold text-[#8C5E0E]">
            נכונות מתחת ל-{CORRECTNESS_FLOOR} - הציון מוגבל ל-{CAPPED_TOTAL} (סכום גולמי {t.raw})
          </span>
        )}
        <span className="ms-auto flex items-center gap-3">
          {savedAt && !state.ok && <span className="text-[12px] text-ink-500">נשמר לאחרונה {new Date(savedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</span>}
          {state.ok && <span className="text-[13px] font-bold text-success">{state.info}</span>}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "שומרת…" : savedAt ? "עדכון הציון" : "שמירת הציון"}
          </Button>
        </span>
      </div>
      {state.error && <Alert variant="danger">{state.error}</Alert>}
    </form>
  );
}
