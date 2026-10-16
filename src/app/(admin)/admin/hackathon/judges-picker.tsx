"use client";

import { useState, useTransition } from "react";
import { Avatar, Button } from "@/components/ui";
import { setHackathonJudge } from "./actions";

export interface JudgeCandidate {
  id: string;
  name: string;
  initials: string;
  ai: boolean;
  judge: boolean;
  scored: number;
}

/** Who may judge (the owner, 16/10): mentors she picks; the team always can. */
export function JudgesPicker({ mentors }: { mentors: JudgeCandidate[] }) {
  const [rows, setRows] = useState(mentors);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const judges = rows.filter((m) => m.judge);
  const toggle = (m: JudgeCandidate) => {
    setError(null);
    start(async () => {
      const r = await setHackathonJudge(m.id, !m.judge);
      if (r.error) return setError(r.error);
      setRows((cur) => cur.map((x) => (x.id === m.id ? { ...x, judge: !m.judge } : x)));
    });
  };
  const shown = rows.filter((m) => !q.trim() || m.name.includes(q.trim()));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap text-[13px]">
        <b className="text-ink-900">שופטות ({judges.length}):</b>
        {judges.length === 0 && <span className="text-ink-500">עדיין לא מינית. הצוות שופט תמיד.</span>}
        {judges.map((j) => (
          <span key={j.id} className="inline-flex items-center gap-1.5 rounded-full bg-tint-purple text-brand-purple px-2.5 py-0.5 font-semibold">
            <Avatar size="xs" initials={j.initials} /> {j.name}
            <span className="text-ink-500 font-normal">· {j.scored} ציונים</span>
            <button type="button" disabled={pending} onClick={() => toggle(j)} className="ms-1 text-ink-400 hover:text-[#B42318]" aria-label={`הסרת ${j.name} מהשופטות`}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <details className="group">
        <summary className="list-none cursor-pointer text-[13px] font-bold text-brand-purple hover:underline [&::-webkit-details-marker]:hidden">+ מינוי מנטורית לשופטת</summary>
        <div className="mt-2 flex flex-col gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מנטורית…" className="w-56 text-[12.5px] border border-ink-300 rounded-md px-3 py-1.5 outline-none focus:border-brand-purple" />
          <div className="flex flex-wrap gap-1.5">
            {shown
              .filter((m) => !m.judge)
              .map((m) => (
                <Button key={m.id} type="button" size="sm" variant="secondary" disabled={pending} onClick={() => toggle(m)}>
                  {m.name}
                  {m.ai ? " · 🤖 AI" : ""}
                </Button>
              ))}
            {shown.filter((m) => !m.judge).length === 0 && <span className="text-[12.5px] text-ink-500">אין מנטוריות נוספות למינוי.</span>}
          </div>
          <p className="text-[12px] text-ink-500">מנטורית שמונתה מקבלת מייל עם הקישור לשיפוט, ופריט ״שיפוט ההאקתון״ בתפריט שלה.</p>
        </div>
      </details>
      {error && <p className="text-[12.5px] font-semibold text-[#B42318]">{error}</p>}
    </div>
  );
}
