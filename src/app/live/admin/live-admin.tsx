"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LIVE_MAX_OPTIONS, LIVE_MIN_FINALISTS, LIVE_MIN_OPTIONS, audienceCriteria, judgesCriteria, parseFinalistLines, round1, weightSum, type LiveAdminChallenge, type LiveAdminView, type LiveCriterion } from "@/lib/hackathon-live-shared";

/*
  לוח הבקרה של ערב הגמר, simplified (the owner, 28/10: ״תפשט את מערכת הניהול
  בצורה נוחה״). The evening is one card at the top - ״מהלך הערב״: the
  challenges in their order, and for the selected one a single next step
  (on screen → judging + audience vote → close → the winner) with what the
  judges and the hall are doing right now. Everything she prepares beforehand
  sits underneath in folding sections: the order of the challenges and their
  contestants, the mix (how the score is computed), the judges, the Yemot
  line, and extra phone questions nobody needs tonight. The API is unchanged.
*/
export interface SubmittedTeam {
  teamKey: string;
  challengeKey: string;
  team: string;
}

const POLL_MS = 2500;
const fmt = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("he-IL");

const card = "bg-white border border-ink-200 rounded-xl p-5 flex flex-col gap-3";
const input = "border border-ink-200 rounded-md px-3 py-2 text-sm bg-ink-50 focus:outline-2 focus:outline-brand-purple";
const btn = "inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-semibold bg-brand-gradient text-white disabled:opacity-40";
const big = "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-[15px] font-bold bg-brand-gradient text-white disabled:opacity-40 shadow-sm";
const ghost = "inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-semibold border border-brand-purple text-brand-purple bg-white hover:bg-tint-purple disabled:opacity-40";
const quiet = "inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[13px] border border-ink-200 bg-ink-50 text-ink-700 hover:bg-ink-100 disabled:opacity-40";
const pillCls = (s: string) => `inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[13px] font-bold border ${s === "open" ? "text-success border-success bg-success-bg" : s === "closed" ? "text-brand-pink-deep border-brand-pink bg-tint-pink" : "text-ink-700 border-ink-200 bg-ink-50"}`;

type Msg = { kind: "ok" | "err"; text: string } | null;
type Api = (body: Record<string, unknown>) => Promise<Record<string, unknown>>;

function Note({ m }: { m: Msg }) {
  if (!m) return null;
  return <div className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${m.kind === "ok" ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{m.text}</div>;
}

/** A folding section: the title and a one-line status stay visible when it is closed. */
function Fold({ id, title, status, defaultOpen, children }: { id: string; title: string; status?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="bg-white border border-ink-200 rounded-xl group" data-testid={`fold-${id}`}>
      <summary className="cursor-pointer select-none px-5 py-3.5 flex items-center gap-3 flex-wrap list-none [&::-webkit-details-marker]:hidden">
        <span className="text-ink-400 text-[13px] transition-transform group-open:rotate-90">▶</span>
        <h2 className="font-display font-bold text-ink-1000">{title}</h2>
        {status ? <span className="text-[13px] text-ink-500">{status}</span> : null}
      </summary>
      <div className="px-5 pb-5 flex flex-col gap-3 border-t border-ink-100 pt-4">{children}</div>
    </details>
  );
}

const statusWord = (ch: LiveAdminChallenge, onScreen: boolean) => (ch.status === "judging" ? "השיפוט פתוח" : ch.status === "closed" ? (ch.revealed ? "הסתיים - המנצחת נחשפה" : "הסתיים") : onScreen ? "על המסך" : "ממתין");

export function LiveAdmin({ initial, submitted }: { initial: LiveAdminView; submitted: SubmittedTeam[] }) {
  const [view, setView] = useState<LiveAdminView>(initial);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<string | null>(initial.finals.active ?? initial.challenges[0]?.key ?? null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/hackathon/live/view?admin=1", { cache: "no-store" });
      if (r.ok) setView((await r.json()) as LiveAdminView);
    } catch {
      /* next tick */
    }
  }, []);
  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  /** The control panel's one door; every answer carries the fresh view. */
  const api = useCallback(async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/hackathon/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => null)) as (Record<string, unknown> & { ok?: boolean; error?: string; view?: LiveAdminView }) | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `שגיאה ${r.status}`);
      if (j.view) setView(j.view);
      return j;
    } finally {
      setBusy(false);
    }
  }, []);

  const control = useCallback(
    async (op: string, id?: string) => {
      try {
        await api({ action: "control", op, id });
      } catch {
        /* the run-of-show card shows its own errors */
      }
    },
    [api]
  );

  // presenter remote on this page too: Page Down / Page Up / Space
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "")) return;
      const map: Record<string, string> = { PageDown: "next", ArrowLeft: "next", PageUp: "prev", ArrowRight: "prev", Space: "toggle" };
      const op = map[e.code];
      if (op) {
        e.preventDefault();
        void control(op);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [control]);

  const configured = view.health.configured && !!view.settings.phoneDisplay;
  const finalistsTotal = view.challenges.reduce((n, c) => n + c.finalistsRaw.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <RunOfShow view={view} api={api} busy={busy} control={control} sel={sel} setSel={setSel} />

      <ChallengesFold view={view} api={api} busy={busy} submitted={submitted} finalistsTotal={finalistsTotal} />
      <MixFold view={view} api={api} busy={busy} />
      <JudgesFold view={view} api={api} busy={busy} />
      <SettingsFold view={view} api={api} busy={busy} defaultOpen={!configured} />
      <QuestionsFold view={view} api={api} busy={busy} control={control} />
    </div>
  );
}

/* ───────────────────────── מהלך הערב ───────────────────────── */

function RunOfShow({ view, api, busy, control, sel, setSel }: { view: LiveAdminView; api: Api; busy: boolean; control: (op: string, id?: string) => Promise<void>; sel: string | null; setSel: (k: string) => void }) {
  const [msg, setMsg] = useState<Msg>(null);
  const chs = view.challenges;
  const ch = chs.find((c) => c.key === sel) ?? chs[0] ?? null;
  const idx = ch ? chs.findIndex((c) => c.key === ch.key) : -1;
  const next = idx >= 0 ? chs[idx + 1] ?? null : null;
  const onScreen = !!ch && view.finals.active === ch.key;
  const judges = ch ? view.judges.filter((j) => j.challengeKey === ch.key) : [];
  const contestants = ch?.finalistsRaw.length ?? 0;
  const myQs = ch ? view.questions.filter((q) => q.challengeKey === ch.key && q.criterionKey) : [];
  const openQ = myQs.find((q) => q.status === "open") ?? null;
  const nextIdle = myQs.find((q) => q.status === "idle") ?? null;
  const doneQs = myQs.filter((q) => q.status === "closed").length;
  const categories = audienceCriteria(view.settings.criteria);
  const catLabel = (key: string | null) => categories.find((c) => c.key === key)?.label ?? "";
  const stage: "none" | "setup" | "idle" | "shown" | "judging" | "closed" = !ch ? "none" : contestants < LIVE_MIN_FINALISTS ? "setup" : ch.status === "judging" ? "judging" : ch.status === "closed" ? "closed" : onScreen ? "shown" : "idle";
  const needReveal = view.settings.reveal === "end";

  const run = async (body: Record<string, unknown>) => {
    try {
      await api(body);
      setMsg(null);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  };
  const finals = (op: string, key: string, extra: Record<string, unknown> = {}) => run({ action: "finals", op, key, ...extra });

  const steps: { label: string; state: "done" | "now" | "next" }[] = [
    { label: "על המסך", state: stage === "idle" || stage === "setup" || stage === "none" ? "next" : stage === "shown" ? "now" : "done" },
    { label: "שיפוט והצבעת קהל", state: stage === "judging" ? "now" : stage === "closed" ? "done" : "next" },
    { label: "סגירה", state: stage === "closed" ? "done" : "next" },
    { label: needReveal ? "חשיפת המנצחת" : "התוצאות על המסך", state: stage === "closed" && (!needReveal || ch?.revealed) ? "done" : stage === "closed" ? "now" : "next" },
  ];

  return (
    <div className={`${card} gap-4`} data-testid="run-of-show">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-display text-lg font-bold text-ink-1000">מהלך הערב</h2>
        <span className={pillCls(view.finals.active ? "open" : "")} data-testid="run-on-screen">
          {view.finals.active ? `על המסך: ${view.finals.name}` : "המסך מציג את הפתיח"}
        </span>
        <span className="text-[13px] text-ink-500" data-testid="run-stats">
          {view.connected == null ? "" : `מחוברים בשלוחה ${fmt(view.connected)} · `}הצביעו {fmt(view.voted)}
          {view.invalid ? ` · הקשות לא תקינות ${fmt(view.invalid)}` : ""}
        </span>
        <span className="flex-1" />
        <a className={ghost} href="/live" target="_blank" rel="noreferrer">
          📺 מסך האולם
        </a>
        <a className={quiet} href="/api/admin/hackathon/live?export=csv">
          ייצוא CSV
        </a>
      </div>

      {/* the challenges in their order - a click selects which one the buttons below drive */}
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="האתגרים">
        {chs.map((c, i) => {
          const selected = ch?.key === c.key;
          const on = view.finals.active === c.key;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSel(c.key)}
              className={`rounded-xl border px-4 py-2 text-right transition-colors ${selected ? "border-brand-purple bg-tint-purple" : "border-ink-200 bg-ink-50 hover:bg-white"}`}
              data-testid="run-chip"
              data-key={c.key}
              data-selected={selected ? "1" : "0"}
              data-status={c.status}
            >
              <span className="block text-[15px] font-bold text-ink-1000">
                {i + 1}. {c.name}
              </span>
              <span className={`block text-[12px] ${c.status === "judging" ? "text-success font-bold" : "text-ink-500"}`}>
                {on && c.status !== "judging" ? "📺 " : ""}
                {statusWord(c, on)} · {c.finalistsRaw.length} מתמודדות
              </span>
            </button>
          );
        })}
        {!chs.length ? <span className="text-sm text-ink-500">אין אתגרים</span> : null}
      </div>

      {ch ? (
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
          <div className="flex flex-col gap-3 rounded-xl border border-ink-200 bg-ink-50/60 p-4" data-testid="run-stage" data-stage={stage}>
            {/* the four steps */}
            <ol className="flex items-center gap-2 flex-wrap text-[12.5px]">
              {steps.map((s, i) => (
                <li key={s.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${s.state === "done" ? "border-success text-success bg-success-bg" : s.state === "now" ? "border-brand-purple text-brand-purple bg-white font-bold" : "border-ink-200 text-ink-500 bg-white"}`}>
                  <span className="font-mono">{s.state === "done" ? "✓" : i + 1}</span> {s.label}
                </li>
              ))}
            </ol>

            {/* what is happening + the one next action */}
            {stage === "setup" ? (
              <>
                <p className="text-sm text-ink-700">
                  ל{ch.name} יש {contestants} מתמודדות - צריך לפחות {LIVE_MIN_FINALISTS}. הוסיפי אותן ב״סדר האתגרים והמתמודדות״ למטה.
                </p>
                <button className={big} disabled data-testid="run-primary">
                  הציגי על המסך ▶
                </button>
              </>
            ) : stage === "idle" ? (
              <>
                <p className="text-sm text-ink-700">{ch.name} מוכן: {contestants} מתמודדות, {judges.length ? `${judges.length} שופטות נכנסו` : "עוד לא נכנסה שופטת"}.</p>
                <button className={big} disabled={busy} onClick={() => finals("show", ch.key)} data-testid="run-primary">
                  הציגי על המסך ▶
                </button>
              </>
            ) : stage === "shown" ? (
              <>
                <p className="text-sm text-ink-700">{ch.name} על המסך. כשהמתמודדות מתחילות להציג - פתחי את השיפוט; השופטות מדרגות מהטלפון אחרי כל הצגה, והקהל מצביע בטלפון קטגוריה אחרי קטגוריה.</p>
                <button className={big} disabled={busy} onClick={() => finals("open", ch.key)} data-testid="run-primary">
                  פתחי שיפוט והצבעת קהל ▶
                </button>
              </>
            ) : stage === "judging" ? (
              <>
                <div className="text-sm text-ink-700 flex flex-col gap-1">
                  <span>
                    <b className="text-success">השיפוט פתוח</b> · {judges.filter((j) => j.scored >= contestants).length} מתוך {judges.length} שופטות סיימו
                  </span>
                  {openQ ? (
                    <span data-testid="run-category">
                      הצבעת קהל: <b>{catLabel(openQ.criterionKey)}</b> ({doneQs + 1} מתוך {myQs.length}) · הצביעו {fmt(openQ.voted)}
                      {view.event.voteSeconds ? ` · ${view.event.voteSeconds} שניות לקטגוריה` : ""}
                    </span>
                  ) : (
                    <span data-testid="run-category">{doneQs === myQs.length && myQs.length ? "כל הקטגוריות נסגרו" : "אין הצבעת קהל פתוחה כרגע"}</span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                  {nextIdle ? (
                    <button className={big} disabled={busy} onClick={() => control("goto", nextIdle.id)} data-testid="run-primary">
                      הקטגוריה הבאה ▶
                    </button>
                  ) : (
                    <button className={big} disabled={busy} onClick={() => finals("close", ch.key)} data-testid="run-primary">
                      סגרי שיפוט ✓
                    </button>
                  )}
                  {openQ ? (
                    <button className={ghost} disabled={busy} onClick={() => control("close")}>
                      סגרי את ההצבעה הזו
                    </button>
                  ) : null}
                  {nextIdle ? (
                    <button className={ghost} disabled={busy} onClick={() => finals("close", ch.key)}>
                      סגרי שיפוט
                    </button>
                  ) : null}
                </div>
              </>
            ) : stage === "closed" ? (
              <>
                <p className="text-sm text-ink-700">
                  {needReveal && !ch.revealed ? "השיפוט נסגר. המסך מראה את ציוני השופטות; המנצחת תיחשף בלחיצה." : "השיפוט הסתיים ולוח התוצאות על המסך."}
                </p>
                <div className="flex gap-2 flex-wrap items-center">
                  {needReveal && !ch.revealed ? (
                    <button className={big} disabled={busy} onClick={() => finals("reveal", ch.key)} data-testid="run-primary">
                      🏆 חשפי את המנצחת
                    </button>
                  ) : next ? (
                    <button
                      className={big}
                      disabled={busy}
                      onClick={async () => {
                        await finals("show", next.key);
                        setSel(next.key);
                      }}
                      data-testid="run-primary"
                    >
                      לאתגר הבא: {next.name} ▶
                    </button>
                  ) : (
                    <span className="text-sm font-bold text-ink-1000" data-testid="run-primary">
                      🎉 זה היה האתגר האחרון
                    </span>
                  )}
                  {needReveal && ch.revealed ? (
                    <button className={quiet} disabled={busy} onClick={() => finals("hide", ch.key)}>
                      הסתירי את המנצחת
                    </button>
                  ) : null}
                  {!onScreen ? (
                    <button className={ghost} disabled={busy} onClick={() => finals("show", ch.key)}>
                      הציגי שוב על המסך
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}

            {/* who is on stage - the judges' pages jump to her (the owner, 28/10) */}
            <div className="flex items-center gap-2 flex-wrap rounded-lg border border-ink-200 bg-white px-3 py-2" data-testid="run-presenters">
              <span className="text-[12.5px] font-bold text-ink-700">מציגות עכשיו:</span>
              {ch.finalistsRaw.map((f) => {
                const on = f.id === ch.currentId;
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={busy}
                    onClick={() => finals("current", ch.key, { finalistId: on ? null : f.id })}
                    className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${on ? "bg-brand-gradient text-white border-transparent" : "bg-ink-50 text-ink-700 border-ink-200 hover:bg-white"}`}
                    data-testid="run-presenter"
                    data-id={f.id}
                    data-on={on ? "1" : "0"}
                  >
                    {f.n}. {f.name}
                  </button>
                );
              })}
              <button
                type="button"
                className={ghost}
                disabled={busy || !ch.finalistsRaw.length}
                onClick={() => {
                  const list = ch.finalistsRaw;
                  const i = list.findIndex((f) => f.id === ch.currentId);
                  const nx = list[(i + 1) % list.length];
                  if (nx) finals("current", ch.key, { finalistId: nx.id });
                }}
                data-testid="run-presenter-next"
              >
                המציגה הבאה ▶
              </button>
              <span className="text-[12px] text-ink-500">{ch.currentId ? "דפי השופטות קפצו אליה" : "אף אחת - דפי השופטות מראים את כולן"}</span>
            </div>
            {/* small levers that are always there */}
            <div className="flex gap-2 flex-wrap items-center pt-1">
              {stage !== "judging" && stage !== "shown" && stage !== "idle" && stage !== "setup" ? null : onScreen ? null : (
                <button className={quiet} disabled={busy} onClick={() => finals("show", ch.key)}>
                  הציגי על המסך
                </button>
              )}
              {stage !== "judging" ? (
                <button
                  className={quiet}
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`לאפס את כל הציונים וההצבעות של ${ch.name}? זה מחזיר אותו למצב ״ממתין״.`)) finals("reset", ch.key);
                  }}
                >
                  אפסי ציונים והצבעות
                </button>
              ) : null}
            </div>
            <Note m={msg} />
            <div className="text-[12px] text-ink-500">שלט מצגת: PageDown הבאה · PageUp הקודמת · רווח פתיחה/סגירה של ההצבעה. עובד גם במסך האולם כשאת מחוברת.</div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-ink-200 bg-white p-4 flex flex-col gap-2" data-testid="run-judges">
              <b className="text-sm text-ink-1000">השופטות של {ch.name}</b>
              {judges.length ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {judges.map((j) => (
                    <li key={j.id} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${j.scored >= contestants && contestants ? "bg-success" : j.scored ? "bg-warning" : "bg-ink-300"}`} />
                      <span className="font-semibold">{j.name}</span>
                      <span className="text-ink-500 tabular-nums">
                        {j.scored} מתוך {contestants}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm text-ink-500">עוד לא נכנסה שופטת - הכתובת והקוד ב״שופטות״ למטה.</span>
              )}
            </div>
            {myQs.length ? (
              <div className="rounded-xl border border-ink-200 bg-white p-4 flex flex-col gap-2" data-testid="run-categories">
                <b className="text-sm text-ink-1000">הצבעות הקהל - לפי הסדר</b>
                <ol className="flex flex-col gap-1 text-sm">
                  {myQs.map((q, i) => (
                    <li key={q.id} className="flex items-center gap-2">
                      <span className="w-5 font-mono text-[12px] text-ink-500">{i + 1}</span>
                      <span className={`flex-1 ${q.status === "open" ? "font-bold text-success" : ""}`}>{catLabel(q.criterionKey)}</span>
                      <span className="text-[12px] text-ink-500 whitespace-nowrap">{q.status === "open" ? "● פתוחה" : q.status === "closed" ? "✓ נסגרה" : "ממתינה"} {q.voted ? `· ${fmt(q.voted)}` : ""}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {ch && ch.finalists.length ? <ResultsTable ch={ch} view={view} /> : null}
    </div>
  );
}

function ResultsTable({ ch, view }: { ch: LiveAdminChallenge; view: LiveAdminView }) {
  const judges = view.judges.filter((j) => j.challengeKey === ch.key);
  return (
    <div className="overflow-auto" data-testid="run-results">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[12px] text-ink-500 text-right">
            <th className="px-2 py-1">#</th>
            <th className="px-2 py-1">מתמודדות</th>
            {judges.map((j) => (
              <th key={j.id} className="px-2 py-1">
                {j.name}
              </th>
            ))}
            <th className="px-2 py-1">שופטות / {view.settings.weights.judges}</th>
            {ch.categories.map((c) => (
              <th key={c.key} className="px-2 py-1">
                {c.label}
                <span className="block font-normal">{c.voted ? `${fmt(c.voted)} הצביעו` : "אין הצבעות"}</span>
              </th>
            ))}
            <th className="px-2 py-1">סופי</th>
            <th className="px-2 py-1">דירוג</th>
          </tr>
        </thead>
        <tbody>
          {ch.finalists.map((f) => (
            <tr key={f.id} className={`border-t border-ink-200 ${f.rank === 1 ? "bg-tint-pink" : ""}`}>
              <td className="px-2 py-1.5">{f.n}</td>
              <td className="px-2 py-1.5">
                <b>{f.name}</b>
                {f.team ? <span className="block text-[12px] text-ink-500">{f.team}</span> : null}
              </td>
              {(f.judges ?? []).map((j) => (
                <td key={j.judgeId} className="px-2 py-1.5 tabular-nums">
                  {j.total === null ? (j.filled ? <span className="text-ink-500">{j.filled}/{judgesCriteria(view.settings.criteria).length}</span> : "—") : j.total}
                </td>
              ))}
              <td className="px-2 py-1.5 font-bold tabular-nums">{f.judgesScore === null ? "—" : f.judgesScore}</td>
              {ch.categories.map((c) => {
                const a = f.audience[c.key];
                return (
                  <td key={c.key} className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                    {a ? `${fmt(a.count)}${a.leading && c.voted ? " ★" : ""}` : "—"}
                    {a && a.score !== null ? <span className="text-ink-500"> · {a.score}</span> : null}
                  </td>
                );
              })}
              <td className="px-2 py-1.5 font-bold tabular-nums">{f.total === null ? "—" : f.total}</td>
              <td className="px-2 py-1.5">{f.rank ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────── סדר האתגרים והמתמודדות ───────────────────────── */

function ChallengesFold({ view, api, busy, submitted, finalistsTotal }: { view: LiveAdminView; api: Api; busy: boolean; submitted: SubmittedTeam[]; finalistsTotal: number }) {
  return (
    <Fold id="challenges" title="סדר האתגרים והמתמודדות" status={`${view.challenges.length} אתגרים · ${finalistsTotal} מתמודדות`} defaultOpen>
      <p className="text-[13px] text-ink-500">הסדר כאן הוא סדר הערב. בכל אתגר שורה לכל צוות - שמות המגישות; מספר השורה הוא המקש בטלפון.</p>
      {view.challenges.map((ch, i) => (
        <ChallengeEditor key={ch.key} ch={ch} i={i} n={view.challenges.length} api={api} busy={busy} submitted={submitted.filter((t) => t.challengeKey === ch.key)} />
      ))}
    </Fold>
  );
}

function ChallengeEditor({ ch, i, n, api, busy, submitted }: { ch: LiveAdminChallenge; i: number; n: number; api: Api; busy: boolean; submitted: SubmittedTeam[] }) {
  const [name, setName] = useState(ch.name);
  const [lines, setLines] = useState(ch.finalistsRaw.map((f) => (f.team ? `${f.name} | ${f.team}` : f.name)).join("\n"));
  const [msg, setMsg] = useState<Msg>(null);
  const [pick, setPick] = useState("");
  const run = async (body: Record<string, unknown>, ok?: string) => {
    try {
      const r = await api(body);
      setMsg(ok ? { kind: "ok", text: ok } : null);
      return r;
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
      return null;
    }
  };
  const saveFinalists = async () => {
    const finalists = parseFinalistLines(lines).map((f) => ({ name: f.team ? `${f.name} | ${f.team}` : f.name, team: "", teamKey: submitted.find((t) => t.team === f.name)?.teamKey ?? null }));
    const r = await run({ action: "challenge-save", key: ch.key, name, finalists }, `נשמרו ${finalists.length} מתמודדות`);
    if (r) {
      const fresh = (r.view as LiveAdminView).challenges.find((c) => c.key === ch.key);
      if (fresh) setLines(fresh.finalistsRaw.map((f) => (f.team ? `${f.name} | ${f.team}` : f.name)).join("\n"));
    }
  };
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-4 flex flex-col gap-3" data-testid="challenge-editor" data-key={ch.key}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex gap-1">
          <button className={quiet} disabled={busy || i === 0} onClick={() => run({ action: "challenge-move", key: ch.key, direction: "up" })} title="למעלה" data-testid="challenge-up">
            ▲
          </button>
          <button className={quiet} disabled={busy || i === n - 1} onClick={() => run({ action: "challenge-move", key: ch.key, direction: "down" })} title="למטה" data-testid="challenge-down">
            ▼
          </button>
        </span>
        <span className="w-6 text-[13px] font-mono text-ink-500">{i + 1}</span>
        <input className={`${input} font-bold min-w-[240px]`} value={name} onChange={(e) => setName(e.target.value)} aria-label="שם האתגר" />
        <span className={pillCls(ch.status === "judging" ? "open" : ch.status === "closed" ? "closed" : "")}>{ch.status === "judging" ? "השיפוט פתוח" : ch.status === "closed" ? "הסתיים" : "ממתין"}</span>
      </div>
      <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          המתמודדות - שורה לכל צוות
          <textarea className={`${input} min-h-[80px] font-normal`} value={lines} onChange={(e) => setLines(e.target.value)} placeholder="רחל כהן + שרה לוי" />
        </label>
        <div className="flex flex-col gap-2">
          <select
            className={input}
            value={pick}
            onChange={(e) => {
              const t = submitted.find((x) => x.teamKey === e.target.value);
              if (t) setLines((l) => (l.trim() ? l.trimEnd() + "\n" : "") + t.team);
              setPick("");
            }}
            aria-label="הוספת צוות מההגשות"
          >
            <option value="">+ מתמודדות מההגשות…</option>
            {submitted.map((t) => (
              <option key={t.teamKey} value={t.teamKey}>
                {t.team}
              </option>
            ))}
          </select>
          <button className={btn} disabled={busy} onClick={saveFinalists}>
            שמרי
          </button>
        </div>
      </div>
      <Note m={msg} />
    </div>
  );
}

/* ───────────────────────── התמהיל ───────────────────────── */

interface Pair {
  j: LiveCriterion;
  a: LiveCriterion;
}

const baseKey = (k: string) => k.replace(/_j$/, "");

/** The judges' and the audience's criteria side by side - by key (ux / ux_j), else by position; null when they do not line up. */
function pairCriteria(criteria: LiveCriterion[]): Pair[] | null {
  const J = judgesCriteria(criteria);
  const A = audienceCriteria(criteria);
  if (!J.length || J.length !== A.length) return null;
  const used = new Set<number>();
  const byKey = J.map((j) => {
    const k = A.findIndex((a, i) => !used.has(i) && baseKey(a.key) === baseKey(j.key));
    if (k >= 0) used.add(k);
    return k;
  });
  if (byKey.every((k) => k >= 0)) return J.map((j, i) => ({ j, a: A[byKey[i]] }));
  return J.map((j, i) => ({ j, a: A[i] }));
}

/** Scales a list of weights to a new total, in halves, the first row absorbing the rounding. */
function rescale(list: LiveCriterion[], target: number): LiveCriterion[] {
  const sum = list.reduce((s, c) => s + c.weight, 0);
  const scaled = list.map((c) => ({ ...c, weight: sum > 0 ? Math.round((c.weight / sum) * target * 2) / 2 : Math.round((target / list.length) * 2) / 2 }));
  const diff = round1(target - scaled.reduce((s, c) => s + c.weight, 0));
  if (scaled.length && Math.abs(diff) >= 0.05) scaled[0] = { ...scaled[0], weight: round1(scaled[0].weight + diff) };
  return scaled;
}

function MixFold({ view, api, busy }: { view: LiveAdminView; api: Api; busy: boolean }) {
  const s = view.settings;
  const [criteria, setCriteria] = useState<LiveCriterion[]>(s.criteria);
  const [audienceMode, setAudienceMode] = useState(s.audienceMode);
  const [reveal, setReveal] = useState(s.reveal);
  const [advanced, setAdvanced] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const pairs = useMemo(() => pairCriteria(criteria), [criteria]);
  const jw = weightSum(judgesCriteria(criteria));
  const aw = weightSum(audienceCriteria(criteria));
  const sum = weightSum(criteria);
  const simple = !!pairs && !advanced;

  const setPairs = (next: Pair[]) => setCriteria([...next.map((p) => p.j), ...next.map((p) => p.a)]);
  const setMix = (judgesPct: number) => {
    const j = Math.max(0, Math.min(100, judgesPct));
    setCriteria([...rescale(judgesCriteria(criteria), j), ...rescale(audienceCriteria(criteria), 100 - j)]);
  };
  const editPair = (i: number, patch: { label?: string; hint?: string; jw?: number; aw?: number }) => {
    if (!pairs) return;
    setPairs(
      pairs.map((p, k) =>
        k !== i
          ? p
          : {
              j: { ...p.j, ...(patch.label !== undefined ? { label: patch.label } : {}), ...(patch.hint !== undefined ? { hint: patch.hint } : {}), ...(patch.jw !== undefined ? { weight: patch.jw } : {}) },
              a: { ...p.a, ...(patch.label !== undefined ? { label: patch.label } : {}), ...(patch.hint !== undefined ? { hint: patch.hint } : {}), ...(patch.aw !== undefined ? { weight: patch.aw } : {}) },
            }
      )
    );
  };
  const movePair = (i: number, dir: -1 | 1) => {
    if (!pairs) return;
    const k = i + dir;
    if (k < 0 || k >= pairs.length) return;
    const next = [...pairs];
    [next[i], next[k]] = [next[k], next[i]];
    setPairs(next);
  };
  const save = async () => {
    try {
      await api({ action: "settings", audienceMode, reveal, criteria });
      setMsg({ kind: "ok", text: "התמהיל נשמר" });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  };
  const setRaw = (i: number, patch: Partial<LiveCriterion>) => setCriteria((cs) => cs.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <Fold id="mix" title="התמהיל - איך מחושב הניקוד" status={`שופטות ${jw}% + קהל ${aw}%`} defaultOpen>
      <p className="text-[13px] text-ink-700 leading-relaxed">
        <b>השופטות</b> מדרגות כל קריטריון 1 עד 10 אחרי כל הצגה; הציון = דירוג ÷ 10 × נקודות הקריטריון, ממוצע בין השופטות שסיימו. <b>הקהל</b> מצביע בטלפון, קטגוריה אחרי קטגוריה, על הפרויקט הטוב ביותר בה - המובילה מקבלת את מלוא הנקודות של הקטגוריה והשאר לפי היחס אליה. <b>הציון הסופי</b> = סכום הנקודות; סך הכול 100.
      </p>

      <div className="flex items-center gap-3 flex-wrap rounded-xl border border-ink-200 bg-ink-50/60 px-4 py-3">
        <span className="text-sm font-bold text-ink-1000">תמהיל ההשפעה</span>
        <input type="range" min={0} max={100} step={5} value={jw} onChange={(e) => setMix(Number(e.target.value))} className="w-56 accent-brand-purple" aria-label="אחוז השופטות" data-testid="mix-slider" />
        <span className="text-sm tabular-nums whitespace-nowrap" data-testid="mix-split">
          שופטות <b>{jw}%</b> · קהל <b>{aw}%</b>
        </span>
        <span className="text-[12px] text-ink-500">הזזת הסליידר מחלקת מחדש את הנקודות בין הקריטריונים לפי היחס הקיים.</span>
      </div>

      {simple ? (
        <table className="w-full text-sm" data-testid="mix-table">
          <thead>
            <tr className="text-[12px] text-ink-500 text-right">
              <th className="px-2 py-1 w-16">סדר</th>
              <th className="px-2 py-1">קריטריון</th>
              <th className="px-2 py-1">הסבר קצר</th>
              <th className="px-2 py-1 w-28">נקודות שופטות</th>
              <th className="px-2 py-1 w-28">נקודות קהל</th>
            </tr>
          </thead>
          <tbody>
            {pairs!.map((p, i) => (
              <tr key={p.j.key || i} className="border-t border-ink-200" data-testid="mix-row">
                <td className="px-2 py-1.5">
                  <span className="flex gap-1">
                    <button className={quiet} disabled={i === 0} onClick={() => movePair(i, -1)} title="למעלה">
                      ▲
                    </button>
                    <button className={quiet} disabled={i === pairs!.length - 1} onClick={() => movePair(i, 1)} title="למטה">
                      ▼
                    </button>
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <input className={`${input} w-full font-semibold`} value={p.j.label} onChange={(e) => editPair(i, { label: e.target.value })} placeholder="שם הקריטריון" />
                </td>
                <td className="px-2 py-1.5">
                  <input className={`${input} w-full`} value={p.j.hint} onChange={(e) => editPair(i, { hint: e.target.value })} placeholder="הסבר קצר לשופטות" />
                </td>
                <td className="px-2 py-1.5">
                  <input className={`${input} w-24`} type="number" min={0} max={100} step={0.5} value={p.j.weight} onChange={(e) => editPair(i, { jw: Number(e.target.value) })} data-testid="mix-jw" />
                </td>
                <td className="px-2 py-1.5">
                  <input className={`${input} w-24`} type="number" min={0} max={100} step={0.5} value={p.a.weight} onChange={(e) => editPair(i, { aw: Number(e.target.value) })} data-testid="mix-aw" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="w-full text-sm" data-testid="mix-advanced">
          <thead>
            <tr className="text-[12px] text-ink-500 text-right">
              <th className="px-2 py-1">קריטריון</th>
              <th className="px-2 py-1">מי מדרגת</th>
              <th className="px-2 py-1">משקל %</th>
              <th className="px-2 py-1">הסבר קצר</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {criteria.map((c, i) => (
              <tr key={c.key || i} className="border-t border-ink-200">
                <td className="px-2 py-1.5">
                  <input className={`${input} w-full`} value={c.label} onChange={(e) => setRaw(i, { label: e.target.value })} placeholder="שם הקריטריון" />
                </td>
                <td className="px-2 py-1.5">
                  <select className={input} value={c.owner} onChange={(e) => setRaw(i, { owner: e.target.value === "audience" ? "audience" : "judges" })}>
                    <option value="judges">השופטות</option>
                    <option value="audience">הקהל</option>
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input className={`${input} w-24`} type="number" min={0} max={100} step={0.5} value={c.weight} onChange={(e) => setRaw(i, { weight: Number(e.target.value) })} />
                </td>
                <td className="px-2 py-1.5">
                  <input className={`${input} w-full`} value={c.hint} onChange={(e) => setRaw(i, { hint: e.target.value })} placeholder="הסבר קצר" />
                </td>
                <td className="px-2 py-1.5">
                  <button className={quiet} onClick={() => setCriteria((cs) => cs.filter((_, k) => k !== i))} title="הסרה">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex gap-3 flex-wrap items-end">
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          נקודות הקהל לשאר הפרויקטים
          <select className={input} value={audienceMode} onChange={(e) => setAudienceMode(e.target.value as "leader" | "share")}>
            <option value="leader">יחסית למנצחת - המנצחת מקבלת הכול, השאר לפי היחס אליה</option>
            <option value="share">לפי חלקן בקולות - 40% מהקולות = 40% מהנקודות</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          המנצחת על המסך
          <select className={input} value={reveal} onChange={(e) => setReveal(e.target.value as "live" | "end")}>
            <option value="end">בלחיצה - אחרי הסגירה ״חשפי את המנצחת״</option>
            <option value="live">בזמן אמת - הציונים זזים תוך כדי</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <button className={btn} disabled={busy || Math.abs(sum - 100) >= 0.01} onClick={save} data-testid="mix-save">
          שמרי תמהיל
        </button>
        <span className={`text-[12px] font-mono ${Math.abs(sum - 100) < 0.01 ? "text-success" : "text-danger"}`} data-testid="mix-sum">
          סה״כ {sum}%{Math.abs(sum - 100) >= 0.01 ? " - חייב להיות 100" : ""}
        </span>
        <span className="flex-1" />
        {!advanced && !pairs ? <span className="text-[12px] text-ink-500">הקריטריונים לא מסתדרים בזוגות - עריכה מתקדמת</span> : null}
        {pairs ? (
          <button className={quiet} onClick={() => setAdvanced((v) => !v)} data-testid="mix-advanced-toggle">
            {advanced ? "חזרה לתצוגה הפשוטה" : "עריכה מתקדמת"}
          </button>
        ) : null}
        {advanced || !pairs ? (
          <button className={quiet} onClick={() => setCriteria((cs) => [...cs, { key: "", label: "", weight: 0, owner: "judges", hint: "" }])}>
            + קריטריון
          </button>
        ) : null}
      </div>
      <Note m={msg} />
    </Fold>
  );
}

/* ───────────────────────── שופטות ───────────────────────── */

function JudgesFold({ view, api, busy }: { view: LiveAdminView; api: Api; busy: boolean }) {
  const [code, setCode] = useState(view.settings.judgeCode);
  const [msg, setMsg] = useState<Msg>(null);
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/live/judge`;
  const chName = (k: string | null) => view.challenges.find((c) => c.key === k)?.name ?? "—";
  const contestants = (k: string | null) => view.challenges.find((c) => c.key === k)?.finalists.length ?? 0;
  const saveCode = async () => {
    try {
      await api({ action: "settings", judgeCode: code });
      setMsg({ kind: "ok", text: "קוד השופטות נשמר" });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  };
  const remove = async (id: string) => {
    if (!confirm("להסיר את השופטת? הציונים שלה יימחקו.")) return;
    try {
      await api({ action: "judges-save", judges: view.judges.filter((j) => j.id !== id).map((j) => ({ id: j.id, name: j.name, challengeKey: j.challengeKey ?? "" })) });
      setMsg(null);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  };
  return (
    <Fold id="judges" title="שופטות" status={`${view.judges.length ? `${view.judges.length} נכנסו` : "עוד לא נכנסה שופטת"} · קוד ${view.settings.judgeCode}`} defaultOpen>
      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          הכתובת לשופטות - מתאימה לטלפון ולטאבלט
          <span className="inline-flex items-center gap-2">
            <code className="text-[13px] text-ink-1000 bg-ink-50 border border-ink-200 rounded-md px-2 py-1.5" dir="ltr">
              {url}
            </code>
            <button
              className={quiet}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  prompt("העתיקי את הכתובת:", url);
                }
              }}
            >
              {copied ? "הועתק ✓" : "העתיקי"}
            </button>
          </span>
        </div>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          קוד השופטות
          <input className={`${input} w-32 tracking-widest`} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <button className={btn} disabled={busy || code === view.settings.judgeCode} onClick={saveCode}>
          שמרי קוד
        </button>
      </div>
      <p className="text-[13px] text-ink-500">השופטת פותחת את הכתובת, כותבת את שמה, בוחרת את האתגר ומקלידה את הקוד - ורואה את המתמודדות של האתגר עם ארבעת הקריטריונים, 1 עד 10 בנגיעה. אותו שם באותו אתגר ממשיך את אותם ציונים.</p>
      <Note m={msg} />
      {view.judges.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[12px] text-ink-500 text-right">
              <th className="px-2 py-1">שם</th>
              <th className="px-2 py-1">אתגר</th>
              <th className="px-2 py-1">דירגה</th>
              <th className="px-2 py-1">נכנסה</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {view.judges.map((j) => (
              <tr key={j.id} className="border-t border-ink-200">
                <td className="px-2 py-1.5 font-semibold">{j.name}</td>
                <td className="px-2 py-1.5">{chName(j.challengeKey)}</td>
                <td className="px-2 py-1.5 tabular-nums">
                  {j.scored} מתוך {contestants(j.challengeKey)}
                </td>
                <td className="px-2 py-1.5 text-ink-500">{new Date(j.createdAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</td>
                <td className="px-2 py-1.5">
                  <button className={quiet} disabled={busy} onClick={() => remove(j.id)} title="הסרה">
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Fold>
  );
}

/* ───────────────────────── ימות ומסך ───────────────────────── */

function SettingsFold({ view, api, busy, defaultOpen }: { view: LiveAdminView; api: Api; busy: boolean; defaultOpen: boolean }) {
  const s = view.settings;
  const [eventName, setEventName] = useState(s.eventName);
  const [phone, setPhone] = useState(s.phoneDisplay);
  const [token, setToken] = useState("");
  const [ext, setExt] = useState(s.yemotExtension);
  const [theme, setTheme] = useState(s.theme);
  const [voteSeconds, setVoteSeconds] = useState(String(s.voteSeconds));
  const [msg, setMsg] = useState<Msg>(null);
  const [test, setTest] = useState<Msg>(null);
  const health = !view.health.configured ? "ימות - לא הוגדר" : view.health.error ? `ימות: ${view.health.error}` : view.health.lastPollAt ? `ימות מחובר · עודכן ${new Date(view.health.lastPollAt).toLocaleTimeString("he-IL")}` : "ימות מוגדר";
  const save = async () => {
    try {
      await api({ action: "settings", eventName, phoneDisplay: phone, yemotToken: token || undefined, yemotExtension: ext, theme, voteSeconds });
      setToken("");
      setMsg({ kind: "ok", text: "נשמר" });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  };
  const runTest = async () => {
    try {
      const r = (await api({ action: "yemot-test" })) as { test?: { ok: boolean; error?: string; extensionExists?: boolean; extensionType?: string | null; isVotingExtension?: boolean; votesInFile?: number | null; activeCalls?: number | null } };
      const t = r.test;
      if (!t?.ok) setTest({ kind: "err", text: t?.error ?? "הבדיקה נכשלה" });
      else setTest({ kind: t.extensionExists && t.isVotingExtension ? "ok" : "err", text: `המפתח תקין. שלוחה ${ext}: ${t.extensionExists ? `קיימת (${t.extensionType ?? "?"}${t.isVotingExtension ? " - שלוחת הצבעה ✓" : " - לא שלוחת הצבעה!"})` : "לא קיימת"} · ${t.votesInFile ?? "?"} הקשות בקובץ · ${t.activeCalls ?? "?"} שיחות פעילות` });
    } catch (e) {
      setTest({ kind: "err", text: (e as Error).message });
    }
  };
  return (
    <Fold id="settings" title="חיבור לימות המשיח ומסך האולם" status={`${health}${s.phoneDisplay ? ` · מספר ${s.phoneDisplay}` : " · אין מספר להצגה"}`} defaultOpen={defaultOpen}>
      <div className="flex gap-3 flex-wrap items-end">
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          שם האירוע על המסך
          <input className={`${input} min-w-[240px]`} value={eventName} onChange={(e) => setEventName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          המספר שיוצג לקהל
          <input className={input} dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="077-0000000" />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          מפתח API של ימות {s.hasToken ? <span className="text-success font-normal">(יש מפתח שמור - השדה ריק בכוונה)</span> : <span className="text-danger font-normal">(אין מפתח)</span>}
          <input className={`${input} min-w-[260px]`} type="password" dir="ltr" value={token} onChange={(e) => setToken(e.target.value)} placeholder={s.hasToken ? "להחלפה - הדביקי מפתח חדש" : "הדביקי את המפתח"} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          שלוחת ההצבעה
          <input className={`${input} w-28`} dir="ltr" value={ext} onChange={(e) => setExt(e.target.value)} placeholder="777" />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          שניות לכל קטגוריה (0 = מעבר ידני)
          <input className={`${input} w-28`} type="number" min={0} max={600} value={voteSeconds} onChange={(e) => setVoteSeconds(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          ערכת המסך
          <select className={input} value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark")}>
            <option value="dark">כהה למקרן</option>
            <option value="light">בהירה</option>
          </select>
        </label>
        <button className={btn} disabled={busy} onClick={save}>
          שמרי
        </button>
        <button className={ghost} disabled={busy || !s.hasToken} onClick={runTest}>
          בדקי חיבור
        </button>
        <a className={quiet} href="/live?theme=light" target="_blank" rel="noreferrer">
          מסך האולם בגרסה בהירה
        </a>
      </div>
      <Note m={msg} />
      <Note m={test} />
      <p className="text-[12px] text-ink-500">השלוחה צריכה להיות מסוג ״קבלת נתונים״ שחוזרת לעצמה, עם זיהוי לפי מספר המתקשר. המפתח נשמר בשרת בלבד ולא מגיע לדפדפן.</p>
    </Fold>
  );
}

/* ───────────────────────── שאלות נוספות ───────────────────────── */

function QuestionsFold({ view, api, busy, control }: { view: LiveAdminView; api: Api; busy: boolean; control: (op: string, id?: string) => Promise<void> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [opts, setOpts] = useState<string[]>(["", "", "", ""]);
  const [reveal, setReveal] = useState<"live" | "end">("live");
  const [msg, setMsg] = useState<Msg>(null);
  const q = view.question;
  const max = q ? Math.max(1, ...q.options.map((o) => o.count ?? 0)) : 1;
  const reset = () => {
    setEditing(null);
    setText("");
    setOpts(["", "", "", ""]);
    setReveal("live");
  };
  const save = async () => {
    try {
      await api({ action: "question-save", id: editing ?? undefined, text, options: opts.map((o) => o.trim()).filter(Boolean), reveal });
      setMsg({ kind: "ok", text: editing ? "השאלה עודכנה" : "השאלה נוספה" });
      reset();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  };
  const act = async (body: Record<string, unknown>) => {
    try {
      await api(body);
      setMsg(null);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  };
  const extra = view.questions.filter((x) => !x.criterionKey);
  return (
    <Fold id="questions" title="שאלות נוספות לקהל (לא חובה)" status={extra.length ? `${extra.length} שאלות` : "הצבעות הגמר נוצרות לבד - כאן רק שאלות חופשיות"}>
      <p className="text-[13px] text-ink-500">שאלות הקהל של הגמר (קטגוריה לכל קריטריון) נוצרות אוטומטית כשפותחים שיפוט. כאן אפשר להוסיף שאלות חופשיות לטלפון - למשל סקר פתיחה - ולנווט ביניהן.</p>

      {q ? (
        <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] text-ink-500 font-mono">שאלה {view.questions.findIndex((x) => x.id === q.id) + 1} מתוך {view.questions.length}</span>
            <span className={pillCls(q.status)}>{q.status === "open" ? "ההצבעה פתוחה" : q.status === "closed" ? "ההצבעה סגורה" : "ממתינים"}</span>
            {q.category ? <span className="text-[12px] rounded-full bg-tint-purple text-brand-purple px-2 py-0.5">הצבעת קהל: {q.category.label}</span> : null}
          </div>
          <div className="font-display text-lg font-bold text-ink-1000">{q.text}</div>
          <div className="grid grid-cols-[auto_minmax(80px,.5fr)_1fr_auto] gap-x-3 gap-y-2 items-center">
            {q.options.map((o) => (
              <div key={o.n} className="contents">
                <div className="w-7 h-7 rounded-lg bg-brand-gradient text-white grid place-items-center font-bold text-sm">{o.n}</div>
                <div className="text-sm">{o.label}</div>
                <div className="h-[18px] bg-tint-indigo rounded-full overflow-hidden relative">
                  <div className="absolute inset-y-0 right-0 bg-brand-gradient rounded-full transition-[width]" style={{ width: `${(((o.count ?? 0) / max) * 100).toFixed(1)}%` }} />
                </div>
                <div className="text-sm tabular-nums whitespace-nowrap">
                  {fmt(o.count)} · {view.voted ? Math.round(o.pct ?? 0) : 0}%
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex gap-2 flex-wrap">
        <button className={ghost} disabled={busy || !q || view.questions.findIndex((x) => x.id === q.id) <= 0} onClick={() => control("prev")}>
          ◀ הקודמת
        </button>
        <button className={ghost} disabled={busy || !view.questions.length || (!!q && view.questions.findIndex((x) => x.id === q.id) >= view.questions.length - 1)} onClick={() => control("next")}>
          {q ? "הבאה ▶" : "התחילי בשאלה הראשונה ▶"}
        </button>
        <button className={ghost} disabled={busy || !q} onClick={() => control("toggle")}>
          {q?.status === "open" ? "סגרי הצבעה" : q ? "פתחי הצבעה מחדש" : "התחילי"}
        </button>
        <button
          className={quiet}
          disabled={busy || !q}
          onClick={() => {
            if (q && confirm("לאפס את כל ההצבעות של השאלה הנוכחית?")) act({ action: "question-reset", id: q.id });
          }}
        >
          אפסי את ההצבעות לשאלה זו
        </button>
        <button
          className={quiet}
          disabled={busy || !view.health.configured}
          onClick={() => {
            if (confirm("להעביר את קובץ ההצבעות בימות לארכיון? ההצבעות שכבר נספרו נשארות.")) control("archive");
          }}
        >
          נקי את קובץ ההצבעות בימות
        </button>
      </div>

      <div className="grid md:grid-cols-[3fr_auto] gap-3 items-end">
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          {editing ? "עריכת שאלה" : "שאלה חדשה"} - הטקסט כפי שיופיע על המסך
          <textarea className={`${input} font-normal`} rows={2} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          מספר אפשרויות
          <select className={input} value={opts.length} onChange={(e) => setOpts((o) => Array.from({ length: Number(e.target.value) }, (_, i) => o[i] ?? ""))}>
            {Array.from({ length: LIVE_MAX_OPTIONS - LIVE_MIN_OPTIONS + 1 }, (_, i) => i + LIVE_MIN_OPTIONS).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {opts.map((o, i) => (
          <input key={i} className={input} value={o} onChange={(e) => setOpts((os) => os.map((x, k) => (k === i ? e.target.value : x)))} placeholder={`אפשרות ${i + 1} (מקש ${i + 1})`} />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap items-end">
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          התוצאות על המסך
          <select className={input} value={reveal} onChange={(e) => setReveal(e.target.value as "live" | "end")}>
            <option value="live">בזמן אמת - רואים את הפסים תוך כדי</option>
            <option value="end">בסיום - רק שאלה ואפשרויות, התוצאות נחשפות בסגירה</option>
          </select>
        </label>
        <button className={btn} disabled={busy} onClick={save}>
          {editing ? "שמרי שינויים" : "הוסיפי שאלה"}
        </button>
        {editing ? (
          <button className={quiet} onClick={reset}>
            ביטול
          </button>
        ) : null}
      </div>
      <Note m={msg} />
      {view.questions.length ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[12px] text-ink-500 text-right">
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">שאלה</th>
              <th className="px-2 py-1">אפשרויות</th>
              <th className="px-2 py-1">מצב</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {view.questions.map((item, i) => (
              <tr key={item.id} className={`border-t border-ink-200 ${item.current ? "bg-tint-purple" : ""}`}>
                <td className="px-2 py-1.5 font-mono text-[12px] text-ink-500">{i + 1}</td>
                <td className="px-2 py-1.5">
                  {item.criterionKey ? "🏆 " : item.reveal === "end" ? "👁 " : ""}
                  {item.text}
                </td>
                <td className="px-2 py-1.5">
                  <span className="flex flex-wrap gap-1">
                    {item.options.map((o, k) => (
                      <span key={k} className="rounded-full border border-ink-200 bg-ink-50 px-2 text-[12px] whitespace-nowrap">
                        <b className="text-brand-purple">{k + 1}</b> {o}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[12px] text-ink-500 whitespace-nowrap">
                  {item.status === "open" ? "● פתוחה" : item.status === "closed" ? "✓ הסתיימה" : ""} {item.voted ? `· ${fmt(item.voted)}` : ""}
                </td>
                <td className="px-2 py-1.5">
                  <span className="flex gap-1 whitespace-nowrap">
                    <button className={quiet} disabled={busy} onClick={() => control("goto", item.id)} title="מעבר לשאלה">
                      ▶
                    </button>
                    <button className={quiet} disabled={busy || i === 0} onClick={() => act({ action: "question-move", id: item.id, direction: "up" })} title="למעלה">
                      ▲
                    </button>
                    <button className={quiet} disabled={busy || i === view.questions.length - 1} onClick={() => act({ action: "question-move", id: item.id, direction: "down" })} title="למטה">
                      ▼
                    </button>
                    {!item.criterionKey ? (
                      <button
                        className={quiet}
                        onClick={() => {
                          setEditing(item.id);
                          setText(item.text);
                          setOpts([...item.options]);
                          setReveal(item.reveal);
                        }}
                      >
                        עריכה
                      </button>
                    ) : null}
                    <button
                      className={quiet}
                      disabled={busy}
                      onClick={() => {
                        if (confirm("למחוק את השאלה?")) act({ action: "question-delete", id: item.id });
                      }}
                    >
                      מחיקה
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Fold>
  );
}
