"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Trophy } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { Sparkle } from "@/app/hackathon-2026/shared";
import type { SubmissionChecklist } from "@/lib/hackathon-submission";
import { submitFinal, type SubmitState } from "./actions";

const ITEMS: { key: keyof Omit<SubmissionChecklist, "done" | "total">; label: string }[] = [
  { key: "product", label: "קישור למוצר עובד" },
  { key: "repo", label: "ספריית גיט ציבורית" },
  { key: "architecture", label: "הסבר על הארכיטקטורה" },
  { key: "video", label: "סרטון (קובץ או קישור)" },
  { key: "tools", label: "כלי ה-AI לפיתוח" },
  { key: "models", label: "מודלי ה-AI של האיג׳נט" },
  { key: "reflection", label: "שלוש השאלות האישיות שלך" },
];

/** The last card: the checklist, and the big button once everything is there. */
export function FinalSubmit({ checklist, submittedAt }: { checklist: SubmissionChecklist; submittedAt: string | null }) {
  const [state, setState] = useState<SubmitState | null>(null);
  const [pending, start] = useTransition();
  const ready = checklist.done === checklist.total;
  const celebrate = state?.ok && state.info?.includes("נקלטה");
  return (
    <section
      className={`relative overflow-hidden rounded-[22px] border-2 p-5 md:p-6 shadow-sm ${ready ? "border-brand-pink bg-tint-pink/30" : "border-ink-200 bg-white"}`}
      style={{ borderRadius: "26px 20px 28px 22px" }}
    >
      {celebrate && (
        <>
          <Sparkle className="absolute top-3 right-8 w-6 h-6" color="#E0418D" />
          <Sparkle className="absolute top-10 left-[20%] w-4 h-4" color="#F0B429" delay="0.4s" />
          <Sparkle className="absolute bottom-6 right-[30%] w-5 h-5" delay="0.9s" />
          <Sparkle className="absolute bottom-4 left-10 w-4 h-4" color="#E0418D" delay="1.3s" />
        </>
      )}
      <div className="flex items-start gap-5 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <div className="font-mono text-[12.5px] text-brand-pink-deep">{"// ההגשה"}</div>
          <h2 className="font-display text-[20px] font-black text-ink-1000 flex items-center gap-2">
            <Trophy size={20} className="text-brand-pink-deep" /> {submittedAt ? "ההגשה שלכן על הבמה" : "מוכנות להגיש?"}
          </h2>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[13.5px]">
            {ITEMS.map((it) => {
              const ok = checklist[it.key];
              return (
                <li key={it.key} className={`flex items-center gap-2 ${ok ? "text-ink-900" : "text-ink-500"}`}>
                  {ok ? <CheckCircle2 size={16} className="text-success shrink-0" /> : <Circle size={16} className="text-ink-300 shrink-0" />}
                  {it.label}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-col items-start gap-2 min-w-[220px]">
          <Button
            type="button"
            disabled={pending || !ready}
            onClick={() => {
              setState(null);
              if (!confirm(submittedAt ? "לעדכן את ההגשה?" : "להגיש את התוצרים? אפשר יהיה לעדכן גם אחר כך.")) return;
              start(async () => setState(await submitFinal()));
            }}
          >
            {pending ? "מגישות…" : submittedAt ? "עדכון ההגשה" : "הגשה סופית 🏆"}
          </Button>
          {!ready && <span className="text-[12px] text-ink-500">הכפתור ייפתח כשכל שבעת החלקים מוכנים.</span>}
          {state?.error && <Alert variant="danger">{state.error}</Alert>}
          {state?.ok && (
            <Alert variant="success">
              {state.info} {celebrate && <>נתראה על הבמה בערב הגמר. המייל עם האישור כבר בדרך לכל הצוות.</>}
            </Alert>
          )}
        </div>
      </div>
    </section>
  );
}
