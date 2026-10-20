"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { H } from "../theme";

/*
  The owner's view of the quiz, in Hightecourse style: who filled it, what the
  conclusion was, who asked to be placed - and who walked away mid-form.
*/
export interface QuizRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  signup_status: "registered" | "planning";
  questions_done: number;
  score: number | null;
  recommendation: "advanced" | "foundations" | null;
  wants_placement: boolean | null;
  downloaded_syllabus: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

const TOTAL_QUESTIONS = 5;

const fmt = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

const REC_LABEL: Record<string, string> = {
  advanced: "מתקדם מאוד",
  foundations: "מהבסיס + תרגול",
};

function progressOf(r: QuizRow): { label: string; abandoned: boolean } {
  if (r.completed_at) return { label: "הושלם", abandoned: false };
  if (r.questions_done === 0) return { label: "נעצרה אחרי הפרטים", abandoned: true };
  return { label: `נעצרה אחרי ${r.questions_done}/${TOTAL_QUESTIONS} שאלות`, abandoned: true };
}

function csvOf(rows: QuizRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["שם", "מייל", "סטטוס הרשמה", "התקדמות", "ניקוד", "המלצה", "רוצה שיבוץ", "הורידה סילבוס", "התחילה ב", "עדכון אחרון"];
  const lines = rows.map((r) =>
    [
      `${r.first_name} ${r.last_name}`,
      r.email,
      r.signup_status === "registered" ? "רשומה לקורס" : "מתכוונת להירשם",
      progressOf(r).label,
      r.score ?? "",
      r.recommendation ? REC_LABEL[r.recommendation] : "",
      r.wants_placement === true ? "כן" : r.wants_placement === false ? "מתלבטת" : "",
      r.downloaded_syllabus ? "כן" : "לא",
      fmt.format(new Date(r.created_at)),
      fmt.format(new Date(r.updated_at)),
    ]
      .map(esc)
      .join(",")
  );
  return "﻿" + [head.map(esc).join(","), ...lines].join("\r\n");
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div
      className="bg-white px-4 py-3.5"
      style={{
        border: `1px solid ${highlight ? H.yellow : H.line}`,
        borderRadius: 10,
        background: highlight ? H.yellowSoft : H.white,
      }}
    >
      <div className="text-[24px] font-black leading-tight" style={{ color: H.navy }}>
        {value}
      </div>
      <div className="text-[13px]" style={{ color: H.muted }}>
        {label}
      </div>
    </div>
  );
}

export function Dashboard({ rows }: { rows: QuizRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) => `${r.first_name} ${r.last_name}`.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle)
    );
  }, [rows, q]);

  const completed = rows.filter((r) => r.completed_at).length;
  const abandoned = rows.length - completed;
  const advanced = rows.filter((r) => r.recommendation === "advanced").length;
  const foundations = rows.filter((r) => r.recommendation === "foundations").length;
  const wantPlacement = rows.filter((r) => r.wants_placement === true).length;

  const exportCsv = () => {
    const blob = new Blob([csvOf(filtered)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hightecourse-ai-quiz.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const signOut = () =>
    start(async () => {
      await createClient().auth.signOut();
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-[24px] font-black" style={{ color: H.navy }}>
            שאלון בחירת המסלול
          </h1>
          <span className="block h-[4px] w-20" style={{ background: H.yellow, borderRadius: 2 }} />
          <p className="text-[14px]" style={{ color: H.muted }}>
            כל מי שנכנסה לשאלון הציבורי: מה יצא לה, מי ביקשה שיבוץ - ומי נעצרה באמצע.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="px-4 py-2.5 text-[14px] font-bold transition-colors"
            style={{ border: `2px solid ${H.navy}`, color: H.navy, background: H.white, borderRadius: 10 }}
          >
            ייצוא CSV
          </button>
          <button
            onClick={signOut}
            disabled={pending}
            className="px-4 py-2.5 text-[14px] font-medium transition-colors disabled:opacity-50"
            style={{ border: `1.5px solid ${H.line}`, color: H.muted, background: H.white, borderRadius: 10 }}
          >
            יציאה
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="נכנסו לשאלון" value={rows.length} />
        <Stat label="השלימו" value={completed} />
        <Stat label="נעצרו באמצע" value={abandoned} highlight={abandoned > 0} />
        <Stat label="מתקדם / מהבסיס" value={`${advanced} / ${foundations}`} />
        <Stat label="ביקשו שיבוץ" value={wantPlacement} />
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="חיפוש לפי שם או מייל..."
        className="w-full max-w-sm bg-white px-4 py-2.5 text-[14.5px] outline-none"
        style={{ border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink }}
      />

      <div className="overflow-x-auto bg-white" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }}>
        <table className="w-full min-w-[880px] text-[14px]">
          <thead>
            <tr style={{ background: H.navy }}>
              {["שם", "מייל", "סטטוס הרשמה", "התקדמות", "המלצה", "שיבוץ", "סילבוס", "התחילה ב"].map((h) => (
                <th key={h} className="px-4 py-3 text-start font-bold text-white">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center" style={{ color: H.muted }}>
                  {rows.length === 0 ? "עוד אף אחת לא מילאה את השאלון." : "אין תוצאות לחיפוש הזה."}
                </td>
              </tr>
            )}
            {filtered.map((r, idx) => {
              const prog = progressOf(r);
              return (
                <tr key={r.id} style={{ background: idx % 2 ? "#F8FAFC" : H.white }}>
                  <td className="px-4 py-3 font-bold" style={{ color: H.navy }}>
                    {r.first_name} {r.last_name}
                  </td>
                  <td className="px-4 py-3" style={{ color: H.ink }} dir="ltr">
                    {r.email}
                  </td>
                  <td className="px-4 py-3" style={{ color: H.ink }}>
                    {r.signup_status === "registered" ? "רשומה לקורס" : "מתכוונת להירשם"}
                  </td>
                  <td className="px-4 py-3">
                    {prog.abandoned ? (
                      <span className="px-2.5 py-1 text-[12.5px] font-bold" style={{ background: H.yellowSoft, color: H.navyDeep, borderRadius: 999 }}>
                        {prog.label}
                      </span>
                    ) : (
                      <span style={{ color: H.green, fontWeight: 600 }}>{prog.label}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.recommendation ? (
                      <span
                        className="px-2.5 py-1 text-[12.5px] font-black"
                        style={
                          r.recommendation === "advanced"
                            ? { background: H.navy, color: H.white, borderRadius: 999 }
                            : { background: H.yellow, color: H.navyDeep, borderRadius: 999 }
                        }
                        title={r.score != null ? `ניקוד: ${r.score}/10` : undefined}
                      >
                        {REC_LABEL[r.recommendation]}
                      </span>
                    ) : (
                      <span style={{ color: H.line }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.wants_placement === true ? (
                      <span className="font-black" style={{ color: H.green }}>
                        כן
                      </span>
                    ) : r.wants_placement === false ? (
                      <span style={{ color: H.muted }}>מתלבטת</span>
                    ) : (
                      <span style={{ color: H.line }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: H.ink }}>
                    {r.downloaded_syllabus ? "כן" : <span style={{ color: H.line }}>—</span>}
                  </td>
                  <td className="px-4 py-3" style={{ color: H.muted }} dir="ltr">
                    {fmt.format(new Date(r.created_at))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
