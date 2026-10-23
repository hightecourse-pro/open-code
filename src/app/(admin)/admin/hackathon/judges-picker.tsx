"use client";

import { useState, useTransition } from "react";
import { Avatar, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { setHackathonJudge, setJudgeChallenges } from "./actions";

export interface JudgeCandidate {
  id: string;
  name: string;
  initials: string;
  role: "mentor" | "admin";
  ai: boolean;
  judge: boolean;
  scored: number;
  /** Empty = every challenge. */
  challengeKeys: string[];
}

/**
 * Who judges what (the owner, 23/10): a mentor or a team member is appointed
 * per challenge; two independent judges per challenge, who never see each
 * other's scores. A team member who is appointed loses the owner's full view.
 */
export function JudgesPicker({ candidates, challenges }: { candidates: JudgeCandidate[]; challenges: { key: string; short: string }[] }) {
  const [rows, setRows] = useState(candidates);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const judges = rows.filter((m) => m.judge);
  const perChallenge = (key: string) => judges.filter((j) => j.challengeKeys.includes(key)).length;

  const appoint = (m: JudgeCandidate, on: boolean) => {
    setError(null);
    start(async () => {
      const r = await setHackathonJudge(m.id, on, m.challengeKeys);
      if (r.error) return setError(r.error);
      setRows((cur) => cur.map((x) => (x.id === m.id ? { ...x, judge: on, challengeKeys: on ? x.challengeKeys : [] } : x)));
    });
  };
  const toggleChallenge = (m: JudgeCandidate, key: string) => {
    const next = m.challengeKeys.includes(key) ? m.challengeKeys.filter((k) => k !== key) : [...m.challengeKeys, key];
    setError(null);
    start(async () => {
      const r = await setJudgeChallenges(m.id, next);
      if (r.error) return setError(r.error);
      setRows((cur) => cur.map((x) => (x.id === m.id ? { ...x, challengeKeys: next } : x)));
    });
  };
  const shown = rows.filter((m) => !m.judge && (!q.trim() || m.name.includes(q.trim())));

  return (
    <div className="flex flex-col gap-3" data-testid="judges-picker">
      <div className="flex items-center gap-2 flex-wrap text-[12.5px] text-ink-600">
        {challenges.map((c) => (
          <span key={c.key} className={cn("rounded-full px-2.5 py-0.5 border", perChallenge(c.key) >= 2 ? "bg-tint-mint border-transparent text-success" : "bg-white border-ink-200")}>
            {c.short}: <b>{perChallenge(c.key)}</b> שופטות{perChallenge(c.key) < 2 ? " (צריך 2)" : " ✓"}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {judges.length === 0 && <span className="text-[13px] text-ink-500">עדיין לא מינית שופטות.</span>}
        {judges.map((j) => (
          <div key={j.id} className="flex items-center gap-2 flex-wrap rounded-[12px] border border-ink-200 px-3 py-2" data-testid="judge-row" data-judge={j.id}>
            <Avatar size="xs" initials={j.initials} />
            <b className="text-[13px] text-ink-900">{j.name}</b>
            {j.role === "admin" && <span className="text-[10.5px] font-bold bg-tint-purple text-brand-purple px-1.5 py-px rounded-full">צוות</span>}
            <span className="text-[12px] text-ink-500">· {j.scored} ציונים</span>
            <span className="ms-2 text-[12px] text-ink-500">שופטת ב:</span>
            {challenges.map((c) => {
              const on = j.challengeKeys.includes(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={pending}
                  onClick={() => toggleChallenge(j, c.key)}
                  aria-pressed={on}
                  data-testid="judge-challenge"
                  data-key={c.key}
                  className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-semibold border transition-colors", on ? "bg-brand-purple text-white border-brand-purple" : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple")}
                >
                  {c.short}
                </button>
              );
            })}
            {j.challengeKeys.length === 0 && <span className="text-[11.5px] font-semibold text-[#8C5E0E]">עוד לא שובצה - לא רואה הגשות</span>}
            <button type="button" disabled={pending} onClick={() => appoint(j, false)} className="ms-auto text-ink-400 hover:text-[#B42318] text-[12.5px]" aria-label={`הסרת ${j.name} מהשופטות`}>
              ✕ הסרה
            </button>
          </div>
        ))}
      </div>
      <details className="group">
        <summary className="list-none cursor-pointer text-[13px] font-bold text-brand-purple hover:underline [&::-webkit-details-marker]:hidden">+ מינוי שופטת (מנטורית או חברת צוות)</summary>
        <div className="mt-2 flex flex-col gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש…" className="w-56 text-[12.5px] border border-ink-300 rounded-md px-3 py-1.5 outline-none focus:border-brand-purple" />
          <div className="text-[12px] font-bold text-ink-500">מנטוריות</div>
          <div className="flex flex-wrap gap-1.5">
            {shown
              .filter((m) => m.role === "mentor")
              .map((m) => (
                <Button key={m.id} type="button" size="sm" variant="secondary" disabled={pending} onClick={() => appoint(m, true)}>
                  {m.name}
                  {m.ai ? " · 🤖 AI" : ""}
                </Button>
              ))}
            {shown.filter((m) => m.role === "mentor").length === 0 && <span className="text-[12.5px] text-ink-500">אין מנטוריות נוספות למינוי.</span>}
          </div>
          <div className="text-[12px] font-bold text-ink-500 mt-1">הצוות</div>
          <div className="flex flex-wrap gap-1.5">
            {shown
              .filter((m) => m.role === "admin")
              .map((m) => (
                <Button key={m.id} type="button" size="sm" variant="secondary" disabled={pending} onClick={() => appoint(m, true)}>
                  {m.name} · צוות
                </Button>
              ))}
            {shown.filter((m) => m.role === "admin").length === 0 && <span className="text-[12.5px] text-ink-500">אין חברות צוות נוספות למינוי.</span>}
          </div>
          <p className="text-[12px] text-ink-500">
            אחרי המינוי בוחרים לה אתגר (או יותר); בלי שיבוץ היא לא רואה הגשות. שופטת רואה רק את ההגשות של האתגרים שלה ורק את הציונים שלה - לא של שופטות אחרות ולא את הבדיקה האוטומטית. חברת צוות שמונתה
            לשופטת לא רואה ציונים של אחרות גם כאן בניהול, עד שתוסר מהרשימה. מנטורית שמונתה מקבלת מייל עם הקישור לשיפוט.
          </p>
        </div>
      </details>
      {error && <p className="text-[12.5px] font-semibold text-[#B42318]">{error}</p>}
    </div>
  );
}
