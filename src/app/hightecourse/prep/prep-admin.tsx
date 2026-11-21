"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { H } from "@/app/ai-course/theme";
import { LICENSE_LABEL, TOOL_NONE, TOOL_OTHER, questionsFor, type PrepAnswers, type PrepKind } from "@/lib/hc-preconf/config";
import { hcPrepResendAction, hcPrepRunAction, hcPrepSamplesAction, hcPrepToggleAction } from "../actions";
import { Card, CardTitle, ExtLink, Notice, Stat, fmtDateTime } from "../ui";

export interface PrepAdminRow {
  id: string;
  isSample: boolean;
  sheetNum: string;
  name: string;
  email: string;
  cc: string;
  company: string;
  course: string;
  courseRaw: string;
  /** the sheet's note after the course name - printed in her mail */
  courseNote: string;
  kind: PrepKind;
  kindLabel: string;
  laptopRequired: boolean;
  /** the sheet's ״מחשב נייד השכרה״ and ״מחשב נייד״ columns (כן / לא / empty) */
  laptopRental: string;
  laptopOwn: string;
  lodging: string;
  updatedPersonal: boolean;
  hold: string;
  removed: boolean;
  mailStatus: string;
  mailSentAt: string | null;
  mailError: string;
  answeredAt: string | null;
  prefilled: boolean;
  answers: PrepAnswers;
  formPath: string;
}

type Filter = "all" | "pending" | "sent" | "held" | "answered" | "unanswered" | "laptop" | "noLaptop" | "noLaptopNoRental" | "noTools" | "notUpdated" | "samples";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "הכול" },
  { key: "pending", label: "טרם נשלח" },
  { key: "sent", label: "נשלח" },
  { key: "held", label: "ממתינות" },
  { key: "answered", label: "מילאו שאלון" },
  { key: "unanswered", label: "לא מילאו" },
  { key: "laptop", label: "קורסי מחשב" },
  { key: "noLaptop", label: "ענו: בלי מחשב" },
  { key: "noLaptopNoRental", label: "בלי מחשב ולא השכירו" },
  { key: "noTools", label: "ענו: בלי כלי AI" },
  { key: "notUpdated", label: "לא עדכנו אזור אישי" },
  { key: "samples", label: "דוגמאות" },
];

/** She answered ״בלי מחשב״ and the sheet has no rental for her (the owner, 22/11: ״מי סימנה שאין לה מחשב ולא השכירה״). */
const noLaptopNoRental = (r: PrepAdminRow) => r.answers.laptop === "no" && r.laptopRental !== "כן";

/** One predicate for the chips: the table filters by it and every chip shows how many rows it holds (the owner, 22/11: ״תוסיף מספרים לכל אחד״). */
function matchesFilter(r: PrepAdminRow, filter: Filter): boolean {
  if (filter === "samples") return r.isSample;
  if (r.isSample || r.removed) return false;
  switch (filter) {
    case "pending":
      return !r.mailStatus && !r.hold;
    case "sent":
      return r.mailStatus === "sent";
    case "held":
      return !!r.hold;
    case "answered":
      return !!r.answeredAt;
    case "unanswered":
      return !r.answeredAt;
    case "laptop":
      return r.laptopRequired;
    case "noLaptop":
      return r.answers.laptop === "no";
    case "noLaptopNoRental":
      return noLaptopNoRental(r);
    case "noTools":
      return (r.answers.tools ?? []).includes(TOOL_NONE);
    case "notUpdated":
      return !r.updatedPersonal;
    default:
      return true;
  }
}

const MAIL_HE: Record<string, string> = { sent: "נשלח", blocked: "נחסם (בדיקה)", error: "שגיאה" };

const btn = (primary = false) => ({ background: primary ? H.navy : H.white, color: primary ? H.white : H.navy, border: `1.5px solid ${H.navy}`, borderRadius: 999 });

function answerSummary(a: PrepAnswers, laptopRental: string): string {
  const parts: string[] = [];
  if (a.role) parts.push(a.role);
  if (a.office) parts.push(a.office);
  if (a.laptop) parts.push(a.laptop === "yes" ? "עם מחשב" : laptopRental === "כן" ? "בלי מחשב - השכירה" : "בלי מחשב - לא השכירה");
  if (a.tools?.length) parts.push(a.tools.join(", ") + (a.toolsOther ? ` (${a.toolsOther})` : ""));
  if (a.license) parts.push(LICENSE_LABEL[a.license]);
  if (a.mgmtRole) parts.push(`ניהול: ${a.mgmtRole}`);
  if (a.employees) parts.push(`${a.employees} עובדים`);
  if (a.years) parts.push(`${a.years} שנות ניסיון`);
  if (a.note) parts.push(`״${a.note}״`);
  return parts.join(" · ");
}

/* ---- per course: which AI tools were named, how many come without a laptop (and did not rent one), how many without a
   licensed tool (the owner, 22/11: ״איזה כלי AI נכתבו לכל קורס, כמה בלי מחשב וכמה בלי כלי AI פר קורס שצריך״) ---- */
interface CourseStat {
  course: string;
  kindLabel: string;
  asksLaptop: boolean;
  asksTools: boolean;
  registered: number;
  answered: number;
  noLaptop: number;
  noLaptopNoRental: number;
  noTools: number;
  /** tool → how many named it; ״אחר״ is counted by the text she typed */
  tools: [string, number][];
}

function courseStats(real: PrepAdminRow[]): CourseStat[] {
  const acc = new Map<string, { c: CourseStat; counts: Map<string, number>; order: number }>();
  for (const r of real) {
    const asks = questionsFor(r.kind, r.laptopRequired);
    if (!asks.laptop && !asks.tools) continue;
    const key = r.course || "בלי קורס";
    let e = acc.get(key);
    if (!e) {
      e = { c: { course: key, kindLabel: r.kindLabel, asksLaptop: asks.laptop, asksTools: !!asks.tools, registered: 0, answered: 0, noLaptop: 0, noLaptopNoRental: 0, noTools: 0, tools: [] }, counts: new Map(), order: r.kind === "dev" ? 0 : r.kind === "ai" ? 1 : 2 };
      acc.set(key, e);
    }
    e.c.registered++;
    if (!r.answeredAt) continue;
    e.c.answered++;
    const a = r.answers;
    if (a.laptop === "no") e.c.noLaptop++;
    if (noLaptopNoRental(r)) e.c.noLaptopNoRental++;
    const tools = a.tools ?? [];
    if (tools.includes(TOOL_NONE)) e.c.noTools++;
    for (const t of tools) {
      if (t === TOOL_NONE) continue;
      const name = t === TOOL_OTHER ? `אחר: ${(a.toolsOther ?? "").trim() || "?"}` : t;
      e.counts.set(name, (e.counts.get(name) ?? 0) + 1);
    }
  }
  return [...acc.values()]
    .sort((x, y) => x.order - y.order || y.c.registered - x.c.registered || x.c.course.localeCompare(y.c.course, "he"))
    .map((e) => ({ ...e.c, tools: [...e.counts.entries()].sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0])) }));
}

/** A count in the per-course card - a click narrows the participants table; grey and inert at 0. */
function Num({ n, red, onClick, testId }: { n: number; red?: boolean; onClick: () => void; testId?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={n === 0} className="text-[15px] font-black tabular-nums disabled:cursor-default" style={{ color: red && n > 0 ? H.red : n === 0 ? H.muted : H.navy }} data-testid={testId}>
      {n}
    </button>
  );
}

function CoursesCard({ courses, onPick }: { courses: CourseStat[]; onPick: (course: string, filter: Filter) => void }) {
  const sum = courses.reduce((s, c) => ({ registered: s.registered + c.registered, answered: s.answered + c.answered, noLaptop: s.noLaptop + c.noLaptop, noLaptopNoRental: s.noLaptopNoRental + c.noLaptopNoRental, noTools: s.noTools + c.noTools }), { registered: 0, answered: 0, noLaptop: 0, noLaptopNoRental: 0, noTools: 0 });
  const th = "px-2 py-2 text-right text-[12.5px] font-bold whitespace-nowrap";
  const td = "px-2 py-2 align-top tabular-nums";
  return (
    <Card testId="hc-prep-courses">
      <CardTitle aside={<span className="text-[13px]" style={{ color: H.muted }}>לפי השאלון · לחיצה על מספר מסננת את טבלת המשתתפות</span>}>לפי קורס: מחשב וכלי AI</CardTitle>
      <div className="overflow-x-auto px-3 pb-3">
        <table className="w-full text-[13.5px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${H.line}`, color: H.muted }}>
              {["קורס", "נרשמו", "מילאו שאלון", "בלי מחשב", "בלי מחשב ולא השכירו", "בלי כלי AI", "כלי AI שנכתבו"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.course} style={{ borderBottom: `1px solid ${H.line}` }} data-testid="hc-prep-course-row" data-course={c.course} data-registered={c.registered} data-answered={c.answered} data-no-rental={c.noLaptopNoRental}>
                <td className="px-2 py-2 align-top" style={{ minWidth: 220 }}>
                  <button type="button" onClick={() => onPick(c.course, "all")} className="text-right font-bold" style={{ color: H.navy }} data-testid="hc-prep-course-name">
                    {c.course}
                  </button>
                  <div className="text-[12px]" style={{ color: H.muted }}>
                    {c.kindLabel}
                    {c.asksLaptop ? " · נדרש מחשב" : ""}
                  </div>
                </td>
                <td className={td}>
                  <Num n={c.registered} onClick={() => onPick(c.course, "all")} />
                </td>
                <td className={td}>
                  <Num n={c.answered} onClick={() => onPick(c.course, "answered")} />
                  {c.registered - c.answered > 0 && (
                    <span className="text-[12px]" style={{ color: H.muted }}>
                      {" "}
                      · לא מילאו {c.registered - c.answered}
                    </span>
                  )}
                </td>
                <td className={td}>{c.asksLaptop ? <Num n={c.noLaptop} red onClick={() => onPick(c.course, "noLaptop")} /> : <span style={{ color: H.muted }}>-</span>}</td>
                <td className={td}>{c.asksLaptop ? <Num n={c.noLaptopNoRental} red onClick={() => onPick(c.course, "noLaptopNoRental")} testId="hc-prep-course-no-rental" /> : <span style={{ color: H.muted }}>-</span>}</td>
                <td className={td}>{c.asksTools ? <Num n={c.noTools} red onClick={() => onPick(c.course, "noTools")} /> : <span style={{ color: H.muted }}>-</span>}</td>
                <td className="px-2 py-2 align-top" style={{ minWidth: 220 }}>
                  {c.tools.length === 0 ? (
                    <span style={{ color: H.muted }}>-</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {c.tools.map(([name, n]) => (
                        <span key={name} className="px-2 py-0.5 text-[12.5px] font-bold whitespace-nowrap" style={{ borderRadius: 999, background: H.row, color: H.navy }} data-testid="hc-prep-course-tool">
                          {name} <span className="font-normal tabular-nums">{n}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-black" style={{ color: H.navy }} data-testid="hc-prep-courses-total">
              <td className="px-2 py-2">סה״כ</td>
              <td className={td}>{sum.registered}</td>
              <td className={td}>{sum.answered}</td>
              <td className={td} style={{ color: sum.noLaptop ? H.red : H.navy }}>
                {sum.noLaptop}
              </td>
              <td className={td} style={{ color: sum.noLaptopNoRental ? H.red : H.navy }}>
                {sum.noLaptopNoRental}
              </td>
              <td className={td} style={{ color: sum.noTools ? H.red : H.navy }}>
                {sum.noTools}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

export function PrepAdmin({ rows, enabled, lastRunAt, lastRun, sheetUrl, sheetTab, defaultSampleTo, subject }: { rows: PrepAdminRow[]; enabled: boolean; lastRunAt: string | null; lastRun: Record<string, unknown> | null; sheetUrl: string | null; sheetTab: string; defaultSampleTo: string; subject: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sampleTo, setSampleTo] = useState(defaultSampleTo);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const real = useMemo(() => rows.filter((r) => !r.isSample && !r.removed), [rows]);
  const stats = useMemo(() => {
    const laptopRows = real.filter((r) => r.laptopRequired);
    return {
      total: real.length,
      sent: real.filter((r) => r.mailStatus === "sent").length,
      pending: real.filter((r) => !r.mailStatus && !r.hold).length,
      held: real.filter((r) => !!r.hold).length,
      errors: real.filter((r) => r.mailStatus === "error" || r.mailStatus === "blocked").length,
      answered: real.filter((r) => !!r.answeredAt).length,
      laptop: laptopRows.length,
      laptopAnswered: laptopRows.filter((r) => !!r.answeredAt).length,
      noLaptop: laptopRows.filter((r) => r.answers.laptop === "no").length,
      noLaptopNoRental: real.filter(noLaptopNoRental).length,
      notUpdated: real.filter((r) => !r.updatedPersonal).length,
      removed: rows.filter((r) => r.removed).length,
    };
  }, [rows, real]);

  const courses = useMemo(() => courseStats(real), [real]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, rows.filter((r) => matchesFilter(r, f.key)).length])) as Record<Filter, number>, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (!matchesFilter(r, filter)) return false;
      if (!needle) return true;
      return [r.name, r.email, r.cc, r.company, r.course, r.courseRaw, r.answers.role ?? "", r.answers.office ?? ""].some((v) => v.toLowerCase().includes(needle));
    });
  }, [rows, filter, q]);

  const run = (fn: () => Promise<{ ok: boolean; text?: string; error?: string }>) =>
    start(async () => {
      setMsg(null);
      setErr(null);
      try {
        const r = await fn();
        if (r.ok) setMsg(r.text ?? "בוצע.");
        else setErr(r.error ?? "לא הצליח.");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "לא הצליח.");
      }
      router.refresh();
    });

  const tick = (send: boolean) =>
    run(async () => {
      const r = await hcPrepRunAction(send);
      if (!r.ok) return { ok: false, error: r.error ?? r.skipped ?? "לא רץ" };
      const s = r.sync;
      const m = r.mail && "sent" in r.mail ? `נשלחו ${r.mail.sent}${r.mail.blocked ? `, נחסמו ${r.mail.blocked}` : ""}${r.mail.errors ? `, שגיאות ${r.mail.errors}` : ""}` : r.mail && "skipped" in r.mail ? (r.mail.skipped === "disabled" ? "השליחה כבויה - לא נשלח" : "בלי שליחה") : "";
      const mir = r.mirror && "rows" in r.mirror ? `הגיליון עודכן (${r.mirror.rows} שורות)` : r.mirror && "error" in r.mirror ? `הגיליון לא עודכן: ${r.mirror.error}` : "בלי גיליון בסביבה הזו";
      return { ok: true, text: `נקרא מהגיליון: ${s?.total ?? 0} פרונטליות (חדשות ${s?.added ?? 0}, הוסרו ${s?.removed ?? 0}, ממתינות ${s?.held ?? 0}) · מילוי מוקדם: ${r.prefilled ?? 0} · ${m} · ${mir}${r.error ? ` · שגיאה: ${r.error}` : ""}` };
    });

  return (
    <div className="space-y-5" data-testid="hc-prep">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-black" style={{ color: H.navy }}>
            מייל לפני הכנס
          </h1>
          <p className="text-[14px]" style={{ color: H.muted }}>
            ״{subject}״ - למשתתפות הפרונטליות מהגיליון, פעם אחת לכל אחת, ושאלון ההכנה שלהן.
          </p>
        </div>
        {sheetUrl && (
          <ExtLink href={sheetUrl} testId="hc-prep-sheet">
            הלשונית ״{sheetTab}״ בגיליון
          </ExtLink>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="משתתפות פרונטליות" value={stats.total} testId="hc-prep-total" />
        <Stat label="נשלח להן" value={stats.sent} testId="hc-prep-sent" />
        <Stat label="טרם נשלח" value={stats.pending} highlight={stats.pending > 0} testId="hc-prep-pending" />
        <Stat label="ממתינות (בלי קורס)" value={stats.held} highlight={stats.held > 0} testId="hc-prep-held" />
        <Stat label="מילאו שאלון" value={stats.answered} sub={`מתוך ${stats.laptop} בקורסי מחשב: ${stats.laptopAnswered}`} testId="hc-prep-answered" />
        <Stat label="ענו: בלי מחשב" value={stats.noLaptop} highlight={stats.noLaptopNoRental > 0} sub={`מתוכן לא השכירו: ${stats.noLaptopNoRental} · לא עדכנו אזור אישי: ${stats.notUpdated}`} testId="hc-prep-nolaptop" />
      </div>

      <CoursesCard
        courses={courses}
        onPick={(course, f) => {
          setFilter(f);
          setQ(course);
        }}
      />

      <Card testId="hc-prep-controls">
        <CardTitle aside={lastRunAt ? <span className="text-[13px]" style={{ color: H.muted }}>ריצה אחרונה: {fmtDateTime.format(new Date(lastRunAt))}</span> : null}>שליחה</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending} onClick={() => run(async () => ((await hcPrepToggleAction(!enabled)).ok ? { ok: true, text: !enabled ? "השליחה הופעלה - הטיימר ישלח לכל מי שטרם נשלח לה, כל חצי שעה." : "השליחה כבויה." } : { ok: false, error: "לא הצליח" }))} className="px-4 py-2 text-[14.5px] font-bold disabled:opacity-60" style={{ ...btn(enabled), background: enabled ? "#1E7F4F" : H.white, borderColor: enabled ? "#1E7F4F" : H.navy }} data-testid="hc-prep-toggle" aria-pressed={enabled}>
            {enabled ? "השליחה פעילה - לכבות" : "השליחה כבויה - להפעיל"}
          </button>
          <button type="button" disabled={pending} onClick={() => tick(true)} className="px-4 py-2 text-[14.5px] font-bold disabled:opacity-60" style={btn(true)} data-testid="hc-prep-run">
            {pending ? "רצה..." : "להריץ עכשיו (קריאה מהגיליון + שליחה)"}
          </button>
          <button type="button" disabled={pending} onClick={() => tick(false)} className="px-4 py-2 text-[14.5px] font-bold disabled:opacity-60" style={btn()} data-testid="hc-prep-run-dry">
            לעדכן מהגיליון בלי לשלוח
          </button>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: H.muted }}>
          הטיימר רץ כל חצי שעה: קורא את ״משתתפות״, מוסיף נרשמות חדשות, שולח למי שטרם נשלח לה (רק כשהשליחה פעילה) ומעדכן את הלשונית בגיליון. שינוי בנוסח המייל נעשה בקוד.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2" style={{ borderTop: `1px solid ${H.line}`, paddingTop: 14 }}>
          <label htmlFor="hc-prep-sample-to" className="text-[14px] font-bold" style={{ color: H.navy }}>
            דוגמאות (9 וריאציות) אל:
          </label>
          <input id="hc-prep-sample-to" dir="ltr" value={sampleTo} onChange={(e) => setSampleTo(e.target.value)} className="min-w-[260px] bg-white px-3 py-1.5 text-[14px] outline-none" style={{ border: `1.5px solid ${H.line}`, borderRadius: 8 }} data-testid="hc-prep-sample-to" />
          <button
            type="button"
            disabled={pending || !sampleTo.includes("@")}
            onClick={() =>
              run(async () => {
                const r = await hcPrepSamplesAction(sampleTo);
                if (r.results.length === 0) return { ok: false, error: r.error ?? "לא נשלח" };
                const okN = r.results.filter((x) => x.ok).length;
                const bad = r.results.filter((x) => !x.ok);
                return { ok: bad.length === 0, text: `נשלחו ${okN} דוגמאות אל ${sampleTo}.`, error: bad.length ? `נשלחו ${okN}; לא נשלחו: ${bad.map((x) => `${x.n} (${x.error})`).join(", ")}` : undefined };
              })
            }
            className="px-4 py-1.5 text-[14px] font-bold disabled:opacity-60"
            style={btn()}
            data-testid="hc-prep-samples"
          >
            לשלוח דוגמאות
          </button>
        </div>
        {msg && (
          <p className="mt-3 text-[14px] font-bold" style={{ color: "#1E7F4F" }} data-testid="hc-prep-msg">
            {msg}
          </p>
        )}
        {err && (
          <div className="mt-3">
            <Notice tone="error" testId="hc-prep-err">
              {err}
            </Notice>
          </div>
        )}
      </Card>

      <Card testId="hc-prep-table">
        <CardTitle aside={<span className="text-[13px]" style={{ color: H.muted }}>{shown.length} שורות</span>}>המשתתפות</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className="px-3 py-1 text-[13.5px] font-bold" style={{ borderRadius: 999, border: `1.5px solid ${filter === f.key ? H.navy : H.line}`, background: filter === f.key ? H.navy : H.white, color: filter === f.key ? H.white : H.navy }} data-testid={`hc-prep-filter-${f.key}`}>
              {f.label} <span className="font-normal" style={{ opacity: 0.85 }} data-testid={`hc-prep-filter-count-${f.key}`}>{counts[f.key]}</span>
            </button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש: שם, מייל, חברה, קורס" className="ms-auto min-w-[220px] bg-white px-3 py-1.5 text-[14px] outline-none" style={{ border: `1.5px solid ${H.line}`, borderRadius: 8 }} data-testid="hc-prep-search" />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[13.5px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: H.muted }}>
                {["מס", "שם", "קורס", "שאלון", "לינה", "אזור אישי", "מייל", "תשובות", ""].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2 py-2 text-right font-bold" style={{ borderBottom: `1px solid ${H.line}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${H.line}`, background: r.hold ? "#FFF7E6" : noLaptopNoRental(r) ? "#FDF1EF" : r.answers.laptop === "no" ? "#FFF4C2" : undefined }} data-testid="hc-prep-row" data-kind={r.kind} data-status={r.mailStatus || (r.hold ? "held" : "pending")}>
                  <td className="px-2 py-2 align-top" dir="ltr">
                    {r.sheetNum}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="font-bold" style={{ color: H.ink }}>
                      {r.name}
                      {r.isSample && <span className="ms-1 text-[12px] font-bold" style={{ color: H.muted }}>(דוגמה)</span>}
                    </div>
                    <div dir="ltr" className="text-[12.5px]" style={{ color: H.muted }}>
                      {r.email}
                      {r.cc ? ` · ${r.cc}` : ""}
                    </div>
                    {r.company && <div className="text-[12.5px]" style={{ color: H.muted }}>{r.company}</div>}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div>{r.course}</div>
                    <div className="text-[12.5px]" style={{ color: H.muted }}>
                      {r.kindLabel}
                      {r.laptopRequired ? " · מחשב" : ""}
                    </div>
                    {r.courseNote && (
                      <div className="text-[12.5px] font-bold" style={{ color: H.red }} data-testid="hc-prep-note">
                        {r.courseNote}
                      </div>
                    )}
                    {r.hold && (
                      <div className="text-[12.5px] font-bold" style={{ color: "#9A5B00" }} data-testid="hc-prep-hold">
                        {r.hold}
                        {r.courseRaw !== r.course ? ` (״${r.courseRaw}״)` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top whitespace-nowrap">{r.answeredAt ? <span className="font-bold" style={{ color: "#1E7F4F" }}>מילאה {fmtDateTime.format(new Date(r.answeredAt))}</span> : r.prefilled ? <span style={{ color: H.muted }}>מילוי מוקדם</span> : <span style={{ color: H.muted }}>-</span>}</td>
                  <td className="px-2 py-2 align-top">{r.lodging}</td>
                  <td className="px-2 py-2 align-top whitespace-nowrap">{r.updatedPersonal ? "עדכנה" : <span className="font-bold" style={{ color: H.red }}>לא עדכנה</span>}</td>
                  <td className="px-2 py-2 align-top whitespace-nowrap">
                    {r.mailStatus ? (
                      <span className="font-bold" style={{ color: r.mailStatus === "sent" ? "#1E7F4F" : H.red }}>
                        {MAIL_HE[r.mailStatus] ?? r.mailStatus}
                      </span>
                    ) : r.hold ? (
                      <span style={{ color: H.muted }}>ממתינה</span>
                    ) : (
                      <span style={{ color: H.muted }}>טרם נשלח</span>
                    )}
                    {r.mailSentAt && <div className="text-[12px]" style={{ color: H.muted }}>{fmtDateTime.format(new Date(r.mailSentAt))}</div>}
                    {r.mailError && <div className="max-w-[220px] text-[12px]" style={{ color: H.red }}>{r.mailError}</div>}
                  </td>
                  <td className="px-2 py-2 align-top" style={{ minWidth: 200 }}>
                    {noLaptopNoRental(r) && (
                      <div className="mb-0.5 text-[12.5px] font-black" style={{ color: H.red }} data-testid="hc-prep-no-rental">
                        בלי מחשב ולא השכירה
                      </div>
                    )}
                    {answerSummary(r.answers, r.laptopRental) || <span style={{ color: H.muted }}>-</span>}
                  </td>
                  <td className="px-2 py-2 align-top whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <a href={`/hightecourse/prep/preview?id=${r.id}`} target="_blank" rel="noreferrer" className="font-bold hover:underline" style={{ color: H.navy }} data-testid="hc-prep-preview">
                        תצוגת המייל
                      </a>
                      <a href={r.formPath} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: H.navy }} data-testid="hc-prep-form-link">
                        השאלון שלה
                      </a>
                      {!r.hold && (
                        <button type="button" disabled={pending} onClick={() => run(async () => ((await hcPrepResendAction(r.id)).ok ? { ok: true, text: `נשלח שוב אל ${r.email}.` } : { ok: false, error: "השליחה נכשלה" }))} className="text-right font-bold hover:underline disabled:opacity-60" style={{ color: H.muted }} data-testid="hc-prep-resend">
                          {r.mailStatus ? "לשלוח שוב" : "לשלוח עכשיו"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-2 py-6 text-center" style={{ color: H.muted }}>
                    אין שורות לסינון הזה.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {stats.removed > 0 && (
          <p className="mt-2 text-[12.5px]" style={{ color: H.muted }}>
            {stats.removed} שורות הוסרו מהגיליון מאז שנקראו (ביטולים) - נשמרות כאן בלי לשלוח.
          </p>
        )}
        {lastRun?.error ? (
          <p className="mt-2 text-[12.5px] font-bold" style={{ color: H.red }}>
            הריצה האחרונה: {String(lastRun.error)}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
