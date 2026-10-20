"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";

/*
  The admin's view of the public AI-course quiz. Three things she asked to see
  at a glance (the owner, 20/10): who filled it, what the conclusion was, and
  who abandoned mid-form - so the summary row counts exactly those.
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

function progressOf(r: QuizRow): { label: string; cls: string } {
  if (r.completed_at) return { label: "הושלם ✓", cls: "bg-tint-green text-green-800" };
  if (r.questions_done === 0) return { label: "נטשה אחרי הפרטים", cls: "bg-amber-100 text-amber-800" };
  return { label: `נטשה אחרי ${r.questions_done}/${TOTAL_QUESTIONS} שאלות`, cls: "bg-amber-100 text-amber-800" };
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

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-amber-300 bg-amber-50" : "border-ink-100 bg-white"}`}>
      <div className="text-2xl font-bold text-ink-900">{value}</div>
      <div className="text-sm text-ink-500">{label}</div>
    </div>
  );
}

export function QuizTable({ rows }: { rows: QuizRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(needle) ||
        r.email.toLowerCase().includes(needle)
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
    a.download = "ai-course-quiz.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">שאלון קורס AI</h1>
          <p className="text-sm text-ink-500">
            מי מילאה את שאלון בחירת המסלול הציבורי (/ai-course), מה יצא לה - ומי נעצרה באמצע.
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          <Download className="h-4 w-4" />
          ייצוא CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="סה״כ נכנסו" value={rows.length} />
        <Stat label="השלימו" value={completed} />
        <Stat label="נטשו באמצע" value={abandoned} accent={abandoned > 0} />
        <Stat label="הומלץ: מתקדם / מהבסיס" value={`${advanced} / ${foundations}`} />
        <Stat label="ביקשו שיבוץ" value={wantPlacement} />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי שם או מייל..."
          className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 pe-9 text-sm outline-none focus:border-ink-400"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-ink-100 text-start text-ink-500">
              {["שם", "מייל", "סטטוס הרשמה", "התקדמות", "המלצה", "שיבוץ", "סילבוס", "התחילה ב"].map((h) => (
                <th key={h} className="px-4 py-3 text-start font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-ink-400">
                  {rows.length === 0 ? "עוד אף אחת לא מילאה את השאלון." : "אין תוצאות לחיפוש הזה."}
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const prog = progressOf(r);
              return (
                <tr key={r.id} className="border-b border-ink-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {r.first_name} {r.last_name}
                  </td>
                  <td className="px-4 py-3 text-ink-600" dir="ltr">
                    {r.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        r.signup_status === "registered" ? "bg-tint-green text-green-800" : "bg-tint-purple text-brand-purple"
                      }`}
                    >
                      {r.signup_status === "registered" ? "רשומה לקורס" : "מתכוונת להירשם"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${prog.cls}`}>{prog.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.recommendation ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          r.recommendation === "advanced" ? "bg-[#004878] text-white" : "bg-[#F8C800] text-[#003A61]"
                        }`}
                        title={r.score != null ? `ניקוד: ${r.score}/10` : undefined}
                      >
                        {REC_LABEL[r.recommendation]}
                      </span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.wants_placement === true ? (
                      <span className="font-bold text-green-700">כן ✓</span>
                    ) : r.wants_placement === false ? (
                      <span className="text-ink-500">מתלבטת</span>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{r.downloaded_syllabus ? "⬇ כן" : <span className="text-ink-300">—</span>}</td>
                  <td className="px-4 py-3 text-ink-500" dir="ltr">
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
