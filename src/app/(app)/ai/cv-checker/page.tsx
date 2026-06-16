"use client";

import { useActionState } from "react";
import { Check, Info, Lightbulb, TriangleAlert, X } from "lucide-react";
import { Alert, Button, Field, ProgressRing, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { runCvCheck, type CvState } from "./actions";

const INSIGHT_STYLE = {
  good: { icon: Check, cls: "bg-tint-mint text-success", label: "חוזק" },
  warn: { icon: TriangleAlert, cls: "bg-tint-warm text-[#8C5E0E]", label: "לשיפור" },
  bad: { icon: X, cls: "bg-danger-bg text-danger", label: "חשוב" },
  tip: { icon: Lightbulb, cls: "bg-tint-purple text-brand-purple", label: "טיפ" },
} as const;

export default function CvCheckerPage() {
  const [state, action, pending] = useActionState<CvState, FormData>(runCvCheck, {});
  const analysis = state.analysis;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;בודקת קו&quot;ח/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">בודקת קורות חיים</h1>
        <p className="t-body-sm text-ink-700">
          תדביקי את קורות החיים שלך — ונעבור עליהן יחד. אפשר גם להוסיף תיאור משרה לבדיקת התאמה.
        </p>
      </div>

      <form action={action} className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex flex-col gap-4">
        {state.error && (
          <Alert variant={state.reason ? "warn" : "danger"}>
            {state.error}
            {state.reason && (
              <a href="/ai/keys" className="block mt-1 font-semibold text-brand-purple underline">
                לניהול מפתחות ה-AI ←
              </a>
            )}
          </Alert>
        )}
        <Field label="קורות החיים שלך" htmlFor="cv">
          <Textarea
            id="cv"
            name="cv"
            rows={10}
            placeholder="הדביקי כאן את הטקסט של קורות החיים…"
            defaultValue=""
          />
        </Field>
        <Field label="תיאור המשרה (אופציונלי — לבדיקת התאמה)" htmlFor="job">
          <Textarea id="job" name="job" rows={4} placeholder="הדביקי תיאור משרה כדי לבדוק כמה את מתאימה…" />
        </Field>
        <Button type="submit" disabled={pending} className="w-fit" bracketed>
          {pending ? "בודקות את קורות החיים שלך…" : "בדיקת קורות חיים"}
        </Button>
      </form>

      {analysis && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex gap-5 items-center">
            <ProgressRing value={analysis.score} size={96} />
            <div>
              <div className="font-display font-bold text-lg text-ink-1000">הציון שלך: {analysis.score}/100</div>
              <p className="t-body-sm text-ink-700 mt-1">{analysis.summary}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {analysis.insights.map((ins, i) => {
              const s = INSIGHT_STYLE[ins.type];
              const Icon = s.icon;
              return (
                <div key={i} className="bg-white border border-ink-200 rounded-md p-4 flex gap-3 items-start">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", s.cls)}>
                    <Icon size={15} />
                  </div>
                  <div>
                    <div className="font-display font-bold text-ink-1000 text-[15px]">{ins.title}</div>
                    <p className="t-body-sm text-ink-700 mt-0.5">{ins.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {analysis.job_fit && (
            <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Info size={18} className="text-brand-purple" />
                <h3 className="font-display font-bold text-ink-1000">התאמה למשרה: {analysis.job_fit.score}/100</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-success mb-1.5">מה שמתאים ✓</div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.job_fit.matched.map((m) => (
                      <span key={m} className="bg-tint-mint text-success text-xs px-2.5 py-1 rounded-full">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-brand-pink-deep mb-1.5">מה שכדאי לחזק</div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.job_fit.missing.map((m) => (
                      <span key={m} className="bg-tint-pink text-brand-pink-deep text-xs px-2.5 py-1 rounded-full">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
