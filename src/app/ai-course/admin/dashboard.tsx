"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { QUESTIONS, TRACKS, type Recommendation } from "../questions";
import { H } from "../theme";
import { deleteSubmission } from "./actions";

/*
  The owner's view of the quiz, in Hightecourse style: who filled it, what the
  conclusion was, who asked to be placed - and who walked away mid-form. A row
  opens to show her five answers; a test row can be removed. Phones get cards
  instead of the wide table.
*/
export interface QuizRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  signup_status: "registered" | "planning";
  /** question id -> score (0/1/2) */
  answers: Record<string, number> | null;
  questions_done: number;
  score: number | null;
  recommendation: Recommendation | null;
  wants_placement: boolean | null;
  downloaded_syllabus: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

type Filter = "all" | "completed" | "abandoned" | "placement" | "advanced" | "foundations";

const TOTAL = QUESTIONS.length;

const fmt = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

const recLabel = (rec: Recommendation | null) => (rec ? TRACKS[rec].badge : "");
const statusLabel = (r: QuizRow) => (r.signup_status === "registered" ? "רשומה לקורס" : "מתכוונת להירשם");

function progressOf(r: QuizRow): { label: string; abandoned: boolean } {
  if (r.completed_at) return { label: "הושלם", abandoned: false };
  if (r.questions_done === 0) return { label: "נעצרה אחרי הפרטים", abandoned: true };
  return { label: `נעצרה אחרי ${r.questions_done}/${TOTAL} שאלות`, abandoned: true };
}

/** Her answer to each question, in the option's own words. */
function answersOf(r: QuizRow): { q: string; a: string | null }[] {
  const scores = r.answers ?? {};
  return QUESTIONS.map((q) => {
    const s = scores[q.id];
    const opt = typeof s === "number" ? q.options.find((o) => o.score === s) : undefined;
    return { q: q.title, a: opt?.label ?? null };
  });
}

function csvOf(rows: QuizRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["שם", "מייל", "סטטוס הרשמה", "התקדמות", "ניקוד", "המלצה", "רוצה שיבוץ", "הורידה סילבוס", "התחילה ב", "עדכון אחרון", ...QUESTIONS.map((q) => q.title)];
  const lines = rows.map((r) =>
    [
      `${r.first_name} ${r.last_name}`,
      r.email,
      statusLabel(r),
      progressOf(r).label,
      r.score ?? "",
      recLabel(r.recommendation),
      r.wants_placement === true ? "כן" : r.wants_placement === false ? "מתלבטת" : "",
      r.downloaded_syllabus ? "כן" : "לא",
      fmt.format(new Date(r.created_at)),
      fmt.format(new Date(r.updated_at)),
      ...answersOf(r).map((x) => x.a ?? ""),
    ]
      .map(esc)
      .join(",")
  );
  return "﻿" + [head.map(esc).join(","), ...lines].join("\r\n");
}

function Stat({ label, value, highlight, testId }: { label: string; value: number | string; highlight?: boolean; testId?: string }) {
  return (
    <div className="px-4 py-3.5" style={{ border: `1px solid ${highlight ? H.yellow : H.line}`, borderRadius: 10, background: highlight ? H.yellowSoft : H.white }} data-testid={testId}>
      <div className="text-[24px] font-black leading-tight" style={{ color: H.navy }}>
        {value}
      </div>
      <div className="text-[13px]" style={{ color: H.muted }}>
        {label}
      </div>
    </div>
  );
}

function RecPill({ rec, score }: { rec: Recommendation | null; score: number | null }) {
  if (!rec) return <span style={{ color: H.line }}>-</span>;
  const style = rec === "advanced" ? { background: H.navy, color: H.white } : { background: H.yellow, color: H.navyDeep };
  return (
    <span className="whitespace-nowrap px-2.5 py-1 text-[12.5px] font-black" style={{ ...style, borderRadius: 999 }} title={score != null ? `ניקוד: ${score}/${TOTAL * 2}` : undefined}>
      {recLabel(rec)}
    </span>
  );
}

function ProgressPill({ r }: { r: QuizRow }) {
  const prog = progressOf(r);
  return prog.abandoned ? (
    <span className="whitespace-nowrap px-2.5 py-1 text-[12.5px] font-bold" style={{ background: H.yellowSoft, color: H.navyDeep, borderRadius: 999 }}>
      {prog.label}
    </span>
  ) : (
    <span style={{ color: H.green, fontWeight: 600 }}>{prog.label}</span>
  );
}

function Placement({ v }: { v: boolean | null }) {
  if (v === true)
    return (
      <span className="font-black" style={{ color: H.green }}>
        כן
      </span>
    );
  if (v === false) return <span style={{ color: H.muted }}>מתלבטת</span>;
  return <span style={{ color: H.line }}>-</span>;
}

function AnswerList({ r }: { r: QuizRow }) {
  const list = answersOf(r);
  return (
    <ol className="space-y-2 text-[13.5px]" data-testid="answers">
      {list.map((x, i) => (
        <li key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <span className="font-bold sm:w-[46%] sm:shrink-0" style={{ color: H.navy }}>
            {i + 1}. {x.q}
          </span>
          <span style={{ color: x.a ? H.ink : H.muted }}>{x.a ?? "לא ענתה"}</span>
        </li>
      ))}
      {r.score != null && (
        <li className="pt-1 text-[13px]" style={{ color: H.muted }}>
          ניקוד: {r.score}/{TOTAL * 2} · {r.score >= 7 ? "7 ומעלה = מתקדם מאוד" : r.score <= 4 ? "4 ומטה = מהבסיס" : "5-6 = לפי שאלת הקצב"}
        </li>
      )}
    </ol>
  );
}

const FILTERS: { v: Filter; label: string }[] = [
  { v: "all", label: "הכל" },
  { v: "completed", label: "השלימו" },
  { v: "abandoned", label: "נעצרו באמצע" },
  { v: "placement", label: "ביקשו שיבוץ" },
  { v: "advanced", label: "מתקדם מאוד" },
  { v: "foundations", label: "מהבסיס" },
];

export function Dashboard({ rows }: { rows: QuizRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "completed" && !r.completed_at) return false;
      if (filter === "abandoned" && r.completed_at) return false;
      if (filter === "placement" && r.wants_placement !== true) return false;
      if (filter === "advanced" && r.recommendation !== "advanced") return false;
      if (filter === "foundations" && r.recommendation !== "foundations") return false;
      if (!needle) return true;
      return `${r.first_name} ${r.last_name}`.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle);
    });
  }, [rows, q, filter]);

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
      try {
        await createClient().auth.signOut();
      } catch {
        /* the refresh shows whatever state we are in */
      }
      router.refresh();
    });

  const remove = (r: QuizRow) => {
    if (!window.confirm(`למחוק את השורה של ${r.first_name} ${r.last_name} (${r.email})? אי אפשר לשחזר.`)) return;
    setNotice(null);
    start(async () => {
      try {
        const res = await deleteSubmission(r.id);
        if (!res.ok) return setNotice(res.error);
        setNotice(`השורה של ${r.first_name} ${r.last_name} נמחקה.`);
        router.refresh();
      } catch {
        setNotice("החיבור נקטע לרגע - נסי שוב.");
      }
    });
  };

  const DeleteButton = ({ r }: { r: QuizRow }) => (
    <button type="button" onClick={() => remove(r)} disabled={pending} className="text-[12.5px] font-medium underline disabled:opacity-50" style={{ color: H.red }} data-testid="delete-row">
      מחיקה
    </button>
  );

  const ToggleButton = ({ r }: { r: QuizRow }) => (
    <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="text-[12.5px] font-medium underline" style={{ color: H.navy }} data-testid="toggle-answers" aria-expanded={open === r.id}>
      {open === r.id ? "לסגור" : "התשובות"}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-[24px] font-black" style={{ color: H.navy }}>
            שאלון בחירת המסלול
          </h1>
          <span className="block h-[4px] w-20" style={{ background: H.yellow, borderRadius: 2 }} />
          <p className="text-[14px]" style={{ color: H.muted }}>
            כל מי שנכנסה לשאלון הציבורי: מה יצא לה, מי ביקשה שיבוץ - ומי נעצרה באמצע. לחיצה על ״התשובות״ פותחת את מה שענתה.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} className="px-4 py-2.5 text-[14px] font-bold transition-colors" style={{ border: `2px solid ${H.navy}`, color: H.navy, background: H.white, borderRadius: 10 }} data-testid="export-csv">
            ייצוא CSV
          </button>
          <button type="button" onClick={signOut} disabled={pending} className="px-4 py-2.5 text-[14px] font-medium transition-colors disabled:opacity-50" style={{ border: `1.5px solid ${H.line}`, color: H.muted, background: H.white, borderRadius: 10 }}>
            יציאה
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="נכנסו לשאלון" value={rows.length} testId="stat-total" />
        <Stat label="השלימו" value={completed} testId="stat-completed" />
        <Stat label="נעצרו באמצע" value={abandoned} highlight={abandoned > 0} testId="stat-abandoned" />
        <Stat label="מתקדם מאוד / מהבסיס" value={`${advanced} / ${foundations}`} testId="stat-tracks" />
        <Stat label="ביקשו שיבוץ" value={wantPlacement} testId="stat-placement" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.v}
            type="button"
            onClick={() => setFilter(f.v)}
            aria-pressed={filter === f.v}
            className="px-3 py-1.5 text-[13px] font-bold transition-colors"
            style={filter === f.v ? { background: H.navy, color: H.white, borderRadius: 999 } : { background: H.white, color: H.navy, border: `1.5px solid ${H.line}`, borderRadius: 999 }}
            data-testid={`filter-${f.v}`}
          >
            {f.label}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי שם או מייל..." className="w-full max-w-sm bg-white px-4 py-2 text-[14px] outline-none sm:ms-auto" style={{ border: `1.5px solid ${H.line}`, borderRadius: 10, color: H.ink }} data-testid="search" />
      </div>

      {notice && (
        <p role="status" className="px-4 py-3 text-[14px] font-medium" style={{ background: H.yellowSoft, color: H.navyDeep, borderRadius: 10 }} data-testid="notice">
          {notice}
        </p>
      )}

      <p className="text-[13px]" style={{ color: H.muted }} data-testid="count-line">
        {filtered.length === rows.length ? `${rows.length} שורות` : `${filtered.length} מתוך ${rows.length} שורות`}
      </p>

      {/* Phones: one card per row */}
      <div className="space-y-3 sm:hidden" data-testid="cards">
        {filtered.length === 0 && (
          <p className="bg-white px-4 py-10 text-center" style={{ border: `1px solid ${H.line}`, borderRadius: 12, color: H.muted }}>
            {rows.length === 0 ? "עוד אף אחת לא מילאה את השאלון." : "אין תוצאות לסינון הזה."}
          </p>
        )}
        {filtered.map((r) => (
          <div key={r.id} className="bg-white p-4" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }} data-testid="card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold" style={{ color: H.navy }}>
                  {r.first_name} {r.last_name}
                </div>
                <div className="truncate text-[13px]" dir="ltr" style={{ color: H.ink, textAlign: "right" }}>
                  {r.email}
                </div>
              </div>
              <RecPill rec={r.recommendation} score={r.score} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]" style={{ color: H.ink }}>
              <ProgressPill r={r} />
              <span>{statusLabel(r)}</span>
              <span>
                שיבוץ: <Placement v={r.wants_placement} />
              </span>
              <span>סילבוס: {r.downloaded_syllabus ? "הורידה" : "-"}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-[12.5px]" style={{ color: H.muted }}>
              <span dir="ltr">{fmt.format(new Date(r.created_at))}</span>
              <span className="flex gap-3">
                <ToggleButton r={r} />
                <DeleteButton r={r} />
              </span>
            </div>
            {open === r.id && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${H.line}` }}>
                <AnswerList r={r} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Wider screens: the table */}
      <div className="hidden overflow-x-auto bg-white sm:block" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }} data-testid="table">
        <table className="w-full min-w-[880px] text-[14px]">
          <thead>
            <tr style={{ background: H.navy }}>
              {["שם", "מייל", "סטטוס הרשמה", "התקדמות", "המלצה", "שיבוץ", "סילבוס", "התחילה ב", ""].map((h, i) => (
                <th key={i} className="px-4 py-3 text-start font-bold text-white">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center" style={{ color: H.muted }}>
                  {rows.length === 0 ? "עוד אף אחת לא מילאה את השאלון." : "אין תוצאות לסינון הזה."}
                </td>
              </tr>
            )}
            {filtered.map((r, idx) => (
              <RowGroup key={r.id} r={r} idx={idx} isOpen={open === r.id} toggle={<ToggleButton r={r} />} del={<DeleteButton r={r} />} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowGroup({ r, idx, isOpen, toggle, del }: { r: QuizRow; idx: number; isOpen: boolean; toggle: React.ReactNode; del: React.ReactNode }) {
  const bg = idx % 2 ? "#F8FAFC" : H.white;
  return (
    <>
      <tr style={{ background: bg }} data-testid="row">
        <td className="px-4 py-3 font-bold" style={{ color: H.navy }}>
          {r.first_name} {r.last_name}
        </td>
        <td className="px-4 py-3" style={{ color: H.ink }} dir="ltr">
          {r.email}
        </td>
        <td className="px-4 py-3" style={{ color: H.ink }}>
          {statusLabel(r)}
        </td>
        <td className="px-4 py-3">
          <ProgressPill r={r} />
        </td>
        <td className="px-4 py-3">
          <RecPill rec={r.recommendation} score={r.score} />
        </td>
        <td className="px-4 py-3">
          <Placement v={r.wants_placement} />
        </td>
        <td className="px-4 py-3" style={{ color: H.ink }}>
          {r.downloaded_syllabus ? "כן" : <span style={{ color: H.line }}>-</span>}
        </td>
        <td className="whitespace-nowrap px-4 py-3" style={{ color: H.muted }} dir="ltr">
          {fmt.format(new Date(r.created_at))}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <span className="flex gap-3">
            {toggle}
            {del}
          </span>
        </td>
      </tr>
      {isOpen && (
        <tr style={{ background: bg }} data-testid="row-answers">
          <td colSpan={9} className="px-6 pb-4 pt-1">
            <div className="px-4 py-3" style={{ background: H.row, borderRadius: 10 }}>
              <AnswerList r={r} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
