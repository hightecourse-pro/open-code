"use client";

import { useActionState, useState } from "react";
import { Briefcase, Code2, Heart } from "lucide-react";
import { Alert, Button, Field, Select } from "@/components/ui";
import { cn } from "@/lib/utils";
import { startInterview, type StartState } from "./actions";
import type { InterviewAgent } from "@/types/database";

const AGENTS: { id: InterviewAgent; label: string; desc: string; icon: typeof Heart }[] = [
  { id: "hr", label: "ראיון HR", desc: "מוטיבציה, ניסיון, התאמה", icon: Briefcase },
  { id: "tech", label: "ראיון טכני", desc: "שאלות מקצועיות וקוד", icon: Code2 },
  { id: "friendly", label: "אימון רך", desc: "תרגול מחזק ותומך", icon: Heart },
];

const TECHS = ["React", "Node.js", "TypeScript", "Python", "SQL", "CSS", "Java"];

export default function InterviewSetupPage() {
  const [agent, setAgent] = useState<InterviewAgent>("hr");
  const [state, action, pending] = useActionState<StartState, FormData>(startInterview, {});

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;ראיונות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">סימולטור ראיונות</h1>
        <p className="t-body-sm text-ink-700">מוכנה? קחי נשימה. אנחנו מאמינות בך 💜 בחרי סוג ראיון ונתחיל.</p>
      </div>

      <form action={action} className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex flex-col gap-5">
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

        <input type="hidden" name="agent" value={agent} />
        <div>
          <div className="text-xs font-semibold text-ink-700 mb-2">סוג הראיון</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {AGENTS.map((a) => {
              const Icon = a.icon;
              const active = agent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAgent(a.id)}
                  className={cn(
                    "text-right rounded-md p-4 border-[1.5px] transition-all",
                    active
                      ? "border-transparent bg-brand-gradient text-white shadow-glow-pink"
                      : "border-ink-200 hover:border-brand-purple"
                  )}
                >
                  <Icon size={20} className="mb-1.5" />
                  <div className="font-display font-bold text-[15px]">{a.label}</div>
                  <div className={cn("text-xs mt-0.5", active ? "opacity-85" : "text-ink-500")}>
                    {a.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Field label="רמת קושי" htmlFor="difficulty">
          <Select id="difficulty" name="difficulty" defaultValue="standard">
            <option value="basic">בסיסי — נעים ורגוע</option>
            <option value="standard">סטנדרטי — לג&apos;וניורית</option>
            <option value="hard">מאתגר — להעמיק</option>
          </Select>
        </Field>

        <div>
          <div className="text-xs font-semibold text-ink-700 mb-2">טכנולוגיות (אופציונלי)</div>
          <div className="flex flex-wrap gap-2">
            {TECHS.map((t) => (
              <label
                key={t}
                className="inline-flex items-center gap-1.5 text-sm bg-ink-50 border border-ink-200 rounded-full px-3 py-1.5 cursor-pointer has-[:checked]:bg-tint-purple has-[:checked]:border-brand-purple has-[:checked]:text-brand-purple"
              >
                <input type="checkbox" name="tech" value={t} className="sr-only" />
                {t}
              </label>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={pending} className="w-fit" bracketed>
          {pending ? "מתחילות…" : "התחלת ראיון"}
        </Button>
      </form>
    </div>
  );
}
