"use client";

import { useCallback, useEffect, useState } from "react";
import { LIVE_MAX_OPTIONS, LIVE_MIN_OPTIONS, parseFinalistLines, type LiveAdminChallenge, type LiveAdminView, type LiveCriterion } from "@/lib/hackathon-live-shared";

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
const ghost = "inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-semibold border border-brand-purple text-brand-purple bg-white hover:bg-tint-purple disabled:opacity-40";
const quiet = "inline-flex items-center justify-center gap-1 rounded-md px-3 py-1.5 text-[13px] border border-ink-200 bg-ink-50 text-ink-700 hover:bg-ink-100 disabled:opacity-40";
const pillCls = (s: string) => `inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[13px] font-bold border ${s === "open" ? "text-success border-success bg-success-bg" : s === "closed" ? "text-brand-pink-deep border-brand-pink bg-tint-pink" : "text-ink-700 border-ink-200 bg-ink-50"}`;

type Msg = { kind: "ok" | "err"; text: string } | null;

function Note({ m }: { m: Msg }) {
  if (!m) return null;
  return <div className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${m.kind === "ok" ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{m.text}</div>;
}

export function LiveAdmin({ initial, submitted }: { initial: LiveAdminView; submitted: SubmittedTeam[] }) {
  const [view, setView] = useState<LiveAdminView>(initial);
  const [busy, setBusy] = useState(false);
  const [ctlMsg, setCtlMsg] = useState<Msg>(null);

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

  const control = async (op: string, id?: string) => {
    try {
      await api({ action: "control", op, id });
      setCtlMsg(null);
    } catch (e) {
      setCtlMsg({ kind: "err", text: (e as Error).message });
    }
  };

  // presenter remote on this page too: Page Down / Page Up / Space
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "")) return;
      const map: Record<string, string> = { PageDown: "next", ArrowLeft: "next", PageUp: "prev", ArrowRight: "prev", Space: "toggle" };
      const op = map[e.code];
      if (op) {
        e.preventDefault();
        control(op);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = view.question;
  const s = view.settings;
  const max = q ? Math.max(1, ...q.options.map((o) => o.count ?? 0)) : 1;

  return (
    <div className="flex flex-col gap-4">
      {/* ─── status + links ─── */}
      <div className={`${card} md:flex-row md:items-center md:flex-wrap`}>
        <span className={`inline-flex items-center gap-1.5 text-[13px] rounded-full border px-3 py-1 ${!view.health.configured ? "border-ink-200 text-ink-500" : view.health.error ? "border-danger text-danger bg-danger-bg" : "border-success text-success bg-success-bg"}`}>
          <i className="w-2 h-2 rounded-full bg-current" /> {!view.health.configured ? "ימות - לא הוגדר" : view.health.error ? `ימות: ${view.health.error}` : view.health.lastPollAt ? `ימות מחובר · עודכן ${new Date(view.health.lastPollAt).toLocaleTimeString("he-IL")}` : "ימות מוגדר"}
        </span>
        <span className={pillCls(view.finals.active ? "open" : "")}>{view.finals.active ? `על המסך: ${view.finals.name}` : "המסך מציג את השאלות"}</span>
        <span className="text-[13px] text-ink-500">{s.phoneDisplay ? `מספר: ${s.phoneDisplay}` : "לא הוגדר מספר להצגה"}</span>
        <span className="flex-1" />
        <a className={ghost} href="/live" target="_blank" rel="noreferrer">
          📺 פתחי את מסך האולם
        </a>
        <a className={quiet} href="/live?theme=dark" target="_blank" rel="noreferrer">
          מסך כהה למקרן
        </a>
        <a className={quiet} href="/api/admin/hackathon/live?export=csv">
          ייצוא CSV
        </a>
      </div>

      {/* ─── control ─── */}
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
        <div className={card}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] text-ink-500 font-mono">{q ? `שאלה ${view.questions.findIndex((x) => x.id === q.id) + 1} מתוך ${view.questions.length}` : view.questions.length ? `${view.questions.length} שאלות מוכנות` : "אין שאלה פעילה"}</span>
            <span className={pillCls(q?.status ?? "")}>{q?.status === "open" ? "ההצבעה פתוחה" : q?.status === "closed" ? "ההצבעה סגורה" : "ממתינים"}</span>
            {q?.challengeKey ? <span className="text-[12px] rounded-full bg-tint-purple text-brand-purple px-2 py-0.5">שאלת קהל של הגמר</span> : null}
          </div>
          <div className="font-display text-xl font-bold text-ink-1000">{q ? q.text : "—"}</div>
          {q ? (
            <div className="text-[13px] text-ink-500">{q.reveal === "end" ? (q.status === "open" ? "👁 תוצאות בסיום - המסך מראה עכשיו רק את השאלה; בסגירה הפסים ייחשפו" : "👁 תוצאות בסיום - ההצבעה סגורה, התוצאות על המסך") : "👁 תוצאות בזמן אמת על המסך"}</div>
          ) : null}
          {q ? (
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
          ) : null}
          <div className="flex gap-2 flex-wrap">
            <button className={ghost} disabled={busy || !q || view.questions.findIndex((x) => x.id === q.id) <= 0} onClick={() => control("prev")}>
              ◀ הקודמת
            </button>
            <button className={btn} disabled={busy || !view.questions.length || (!!q && view.questions.findIndex((x) => x.id === q.id) >= view.questions.length - 1)} onClick={() => control("next")}>
              {q ? "הבאה ▶" : "התחילי בשאלה הראשונה ▶"}
            </button>
            <button className={ghost} disabled={busy || !q} onClick={() => control("toggle")}>
              {q?.status === "open" ? (q.reveal === "end" ? "סגרי הצבעה וחשפי תוצאות" : "סגרי הצבעה") : q ? "פתחי הצבעה מחדש" : "התחילי"}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              className={quiet}
              disabled={busy || !q}
              onClick={() => {
                if (q && confirm("לאפס את כל ההצבעות של השאלה הנוכחית?")) api({ action: "question-reset", id: q.id }).catch((e) => setCtlMsg({ kind: "err", text: e.message }));
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
          <Note m={ctlMsg} />
          <div className="text-[12px] text-ink-500">שלט מצגת: PageDown הבאה · PageUp הקודמת · רווח פתיחה/סגירה. עובד גם במסך האולם כשאת מחוברת.</div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              [view.connected == null ? "—" : fmt(view.connected), "מחוברים בשלוחה"],
              [fmt(view.voted), "הצביעו"],
              [fmt(view.changed), "שינו הצבעה"],
              [fmt(view.invalid), "הקשות לא תקינות"],
            ].map(([v, l]) => (
              <div key={l} className="bg-white border border-ink-200 rounded-xl px-3 py-2">
                <b className="block text-2xl font-black">{v}</b>
                <span className="text-[12px] text-ink-500">{l}</span>
              </div>
            ))}
          </div>
          <div className={card}>
            <h2 className="font-display font-bold text-ink-1000">סדר השאלות <span className="text-[12px] font-mono text-brand-pink-deep">&lt;לחיצה = מעבר/&gt;</span></h2>
            <ul className="border border-ink-200 rounded-md divide-y divide-ink-200 max-h-[50vh] overflow-auto">
              {view.questions.length ? (
                view.questions.map((item, i) => (
                  <li key={item.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-ink-50 ${item.current ? "bg-tint-purple outline-2 outline-brand-purple -outline-offset-2" : ""}`} onClick={() => control("goto", item.id)}>
                    <span className="w-6 text-[12px] text-ink-500 font-mono">{i + 1}</span>
                    <span className="flex-1 truncate text-sm">
                      {item.reveal === "end" ? "👁 " : ""}
                      {item.challengeKey ? "🏆 " : ""}
                      {item.text}
                    </span>
                    <span className="text-[12px] text-ink-500 whitespace-nowrap">
                      {item.current ? (item.status === "open" ? "● פתוחה" : "נוכחית") : item.status === "closed" ? "✓ הסתיימה" : ""} {item.voted ? `· ${fmt(item.voted)} הצביעו` : ""}
                    </span>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-sm text-ink-500">אין שאלות - הוסיפי למטה</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* ─── finals ─── */}
      {view.challenges.map((ch) => (
        <ChallengeCard key={ch.key} ch={ch} view={view} api={api} busy={busy} submitted={submitted.filter((t) => t.challengeKey === ch.key)} />
      ))}
      <JudgesCard view={view} api={api} busy={busy} />
      <WeightsCard view={view} api={api} busy={busy} />

      {/* ─── questions ─── */}
      <QuestionsCard view={view} api={api} busy={busy} />

      {/* ─── yemot + screen ─── */}
      <SettingsCard view={view} api={api} busy={busy} />
    </div>
  );
}

type Api = (body: Record<string, unknown>) => Promise<Record<string, unknown>>;

function ChallengeCard({ ch, view, api, busy, submitted }: { ch: LiveAdminChallenge; view: LiveAdminView; api: Api; busy: boolean; submitted: SubmittedTeam[] }) {
  const [name, setName] = useState(ch.name);
  const [lines, setLines] = useState(ch.finalistsRaw.map((f) => (f.team ? `${f.name} | ${f.team}` : f.name)).join("\n"));
  const [msg, setMsg] = useState<Msg>(null);
  const [pick, setPick] = useState("");
  const judges = view.judges.filter((j) => j.challengeKey === ch.key);
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
    const finalists = parseFinalistLines(lines).map((f) => ({ ...f, teamKey: submitted.find((t) => t.team === f.team)?.teamKey ?? null }));
    const r = await run({ action: "challenge-save", key: ch.key, name, finalists }, `נשמרו ${finalists.length} סופיות`);
    if (r) {
      const fresh = (r.view as LiveAdminView).challenges.find((c) => c.key === ch.key);
      if (fresh) setLines(fresh.finalistsRaw.map((f) => (f.team ? `${f.name} | ${f.team}` : f.name)).join("\n"));
    }
  };
  return (
    <div className={card}>
      <div className="flex items-center gap-3 flex-wrap">
        <input className={`${input} font-bold min-w-[260px]`} value={name} onChange={(e) => setName(e.target.value)} aria-label="שם האתגר" />
        <span className={pillCls(ch.status === "judging" ? "open" : ch.status === "closed" ? "closed" : "")}>{ch.status === "judging" ? "השיפוט פתוח" : ch.status === "closed" ? "השיפוט סגור" : "לא נפתח"}</span>
        {view.finals.active === ch.key ? <span className="text-[12px] rounded-full bg-tint-purple text-brand-purple px-2 py-0.5 font-semibold">📺 על המסך</span> : null}
        <span className="text-[13px] text-ink-500">{judges.length ? `${judges.length} שופטות` : "אין שופטות משובצות"}</span>
      </div>
      <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          הסופיות - שורה לכל פרויקט: שם הפרויקט | שמות הצוות (מספר השורה = המקש בטלפון)
          <textarea className={`${input} min-h-[96px] font-normal`} value={lines} onChange={(e) => setLines(e.target.value)} placeholder="המערכת של רחל | רחל כהן + שרה לוי" />
        </label>
        <div className="flex flex-col gap-2">
          <select
            className={input}
            value={pick}
            onChange={(e) => {
              const t = submitted.find((x) => x.teamKey === e.target.value);
              if (t) setLines((l) => (l.trim() ? l.trimEnd() + "\n" : "") + `${t.team} | ${t.team}`);
              setPick("");
            }}
            aria-label="הוספת צוות מההגשות"
          >
            <option value="">+ צוות מההגשות…</option>
            {submitted.map((t) => (
              <option key={t.teamKey} value={t.teamKey}>
                {t.team}
              </option>
            ))}
          </select>
          <button className={btn} disabled={busy} onClick={saveFinalists}>
            שמרי סופיות
          </button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <button className={quiet} disabled={busy} onClick={() => run({ action: "finals", op: "question", key: ch.key }, "שאלת הקהל מוכנה - אפשר לצרף לה הקלטה בלשונית השאלות")}>
          הכיני שאלת קהל
        </button>
        <button className={ghost} disabled={busy} onClick={() => run({ action: "finals", op: "show", key: ch.key })}>
          הציגי על המסך
        </button>
        <button className={btn} disabled={busy} onClick={() => run({ action: "finals", op: "open", key: ch.key })}>
          פתחי שיפוט והצבעת קהל
        </button>
        <button className={ghost} disabled={busy} onClick={() => run({ action: "finals", op: "close", key: ch.key })}>
          סגרי שיפוט
        </button>
        {view.settings.reveal === "end" ? (
          ch.revealed ? (
            <button className={quiet} disabled={busy} onClick={() => run({ action: "finals", op: "hide", key: ch.key })}>
              הסתירי תוצאות
            </button>
          ) : (
            <button className={ghost} disabled={busy} onClick={() => run({ action: "finals", op: "reveal", key: ch.key })}>
              חשפי תוצאות
            </button>
          )
        ) : null}
        <select className={input} value={ch.currentId ?? ""} onChange={(e) => run({ action: "finals", op: "current", key: ch.key, finalistId: e.target.value || null })} aria-label="מציגות עכשיו">
          <option value="">— מציגות עכשיו —</option>
          {ch.finalists.map((f) => (
            <option key={f.id} value={f.id}>
              {f.n}. {f.name}
            </option>
          ))}
        </select>
        <button
          className={quiet}
          disabled={busy}
          onClick={() => {
            if (confirm("לאפס את כל ציוני השופטות באתגר הזה?")) run({ action: "finals", op: "reset", key: ch.key }, "הציונים אופסו");
          }}
        >
          אפסי ציונים
        </button>
      </div>
      <Note m={msg} />
      {ch.finalists.length ? (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[12px] text-ink-500 text-right">
                <th className="px-2 py-1">#</th>
                <th className="px-2 py-1">פרויקט</th>
                {judges.map((j) => (
                  <th key={j.id} className="px-2 py-1">
                    {j.name}
                  </th>
                ))}
                <th className="px-2 py-1">ממוצע שופטות</th>
                <th className="px-2 py-1">קהל</th>
                <th className="px-2 py-1">ציון קהל</th>
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
                      {j.total === null ? (j.filled ? <span className="text-ink-500">{j.filled}/{view.settings.criteria.length}</span> : "—") : j.total}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 font-bold tabular-nums">{f.judgesAvg === null || f.judgesAvg === undefined ? "—" : f.judgesAvg}</td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {fmt(f.audience.count)} · {f.audience.pct}%
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">{f.audience.score === null ? "—" : f.audience.score}</td>
                  <td className="px-2 py-1.5 font-bold tabular-nums">{f.total === null || f.total === undefined ? "—" : f.total}</td>
                  <td className="px-2 py-1.5">{f.rank ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-[13px] text-ink-500">עוד אין סופיות - הוסיפי למעלה ולחצי ״שמרי סופיות״</div>
      )}
    </div>
  );
}

function JudgesCard({ view, api, busy }: { view: LiveAdminView; api: Api; busy: boolean }) {
  const [rows, setRows] = useState(view.judges.map((j) => ({ id: j.id, name: j.name, challengeKey: j.challengeKey ?? "", token: j.token })));
  const [msg, setMsg] = useState<Msg>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const save = async () => {
    try {
      const r = await api({ action: "judges-save", judges: rows.map((x) => ({ id: x.id || undefined, name: x.name, challengeKey: x.challengeKey })) });
      const fresh = (r.view as LiveAdminView).judges;
      setRows(fresh.map((j) => ({ id: j.id, name: j.name, challengeKey: j.challengeKey ?? "", token: j.token })));
      setMsg({ kind: "ok", text: "השופטות נשמרו - הקישורים האישיים מוכנים להעתקה" });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  };
  return (
    <div className={card}>
      <h2 className="font-display font-bold text-ink-1000">שופטות <span className="text-[12px] font-mono text-brand-pink-deep">&lt;קישור אישי לכל אחת/&gt;</span></h2>
      <p className="text-[13px] text-ink-500">כל שופטת מקבלת קישור אישי לטלפון שלה - בלי כניסה למערכת. הקישור הוא הזהות, לכן שולחים אותו רק לה.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[12px] text-ink-500 text-right">
            <th className="px-2 py-1">שם</th>
            <th className="px-2 py-1">אתגר</th>
            <th className="px-2 py-1">הקישור האישי</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const url = r.token ? `${origin}/live/judge/${r.token}` : "";
            return (
              <tr key={r.id || `new-${i}`} className="border-t border-ink-200">
                <td className="px-2 py-1.5">
                  <input className={input} value={r.name} onChange={(e) => setRows((rs) => rs.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} placeholder="שם השופטת" />
                </td>
                <td className="px-2 py-1.5">
                  <select className={input} value={r.challengeKey} onChange={(e) => setRows((rs) => rs.map((x, k) => (k === i ? { ...x, challengeKey: e.target.value } : x)))}>
                    <option value="">— לא שובצה —</option>
                    {view.challenges.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  {url ? (
                    <span className="inline-flex items-center gap-2">
                      <code className="text-[12px] text-ink-700 max-w-[320px] truncate inline-block" dir="ltr">
                        {url}
                      </code>
                      <button
                        className={quiet}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(url);
                            setCopied(r.id);
                            setTimeout(() => setCopied(null), 1500);
                          } catch {
                            prompt("העתיקי את הקישור:", url);
                          }
                        }}
                      >
                        {copied === r.id ? "הועתק ✓" : "העתיקי"}
                      </button>
                    </span>
                  ) : (
                    <span className="text-[12px] text-ink-500">נוצר בשמירה</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <button className={quiet} onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))} title="הסרה">
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button className={quiet} onClick={() => setRows((rs) => [...rs, { id: "", name: "", challengeKey: "", token: "" }])}>
          + שופטת
        </button>
        <button className={btn} disabled={busy} onClick={save}>
          שמרי שופטות
        </button>
      </div>
      <Note m={msg} />
    </div>
  );
}

function WeightsCard({ view, api, busy }: { view: LiveAdminView; api: Api; busy: boolean }) {
  const s = view.settings;
  const [judgesW, setJudgesW] = useState(String(s.weights.judges));
  const [audienceMode, setAudienceMode] = useState(s.audienceMode);
  const [reveal, setReveal] = useState(s.reveal);
  const [criteria, setCriteria] = useState<LiveCriterion[]>(s.criteria);
  const [msg, setMsg] = useState<Msg>(null);
  const sum = Math.round(criteria.reduce((a, c) => a + (Number(c.weight) || 0), 0) * 10) / 10;
  const save = async () => {
    try {
      await api({ action: "settings", weightsJudges: judgesW, audienceMode, reveal, criteria });
      setMsg({ kind: "ok", text: "השקלול נשמר" });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  };
  return (
    <div className={card}>
      <h2 className="font-display font-bold text-ink-1000">השקלול <span className="text-[12px] font-mono text-brand-pink-deep">&lt;ציון סופי = שופטות + קהל/&gt;</span></h2>
      <div className="flex gap-3 flex-wrap items-end">
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          משקל השופטות %<input className={`${input} w-24`} type="number" min={0} max={100} value={judgesW} onChange={(e) => setJudgesW(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          משקל הקהל %<input className={`${input} w-24`} type="number" min={0} max={100} value={String(100 - (Number(judgesW) || 0))} onChange={(e) => setJudgesW(String(100 - (Number(e.target.value) || 0)))} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          ציון הקהל
          <select className={input} value={audienceMode} onChange={(e) => setAudienceMode(e.target.value as "leader" | "share")}>
            <option value="leader">יחסית למובילה - המובילה מקבלת 100</option>
            <option value="share">חלק מכלל הקולות - 40% מהקולות = 40</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          הציונים על המסך
          <select className={input} value={reveal} onChange={(e) => setReveal(e.target.value as "live" | "end")}>
            <option value="live">בזמן אמת - השקלול זז תוך כדי</option>
            <option value="end">בסיום - הקהל חי, הציונים נחשפים בלחיצה</option>
          </select>
        </label>
      </div>
      <h3 className="font-display font-bold text-ink-1000 mt-2">
        הקריטריונים <span className={`text-[12px] font-mono ${Math.abs(sum - 100) < 0.01 ? "text-success" : "text-danger"}`}>&lt;סה״כ {sum}%/&gt;</span>
      </h3>
      <p className="text-[13px] text-ink-500">השופטת מדרגת כל קריטריון 1 עד 10; הציון שלה = סכום (דירוג ÷ 10 × משקל). סכום המשקלים חייב להיות 100.</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[12px] text-ink-500 text-right">
            <th className="px-2 py-1">קריטריון</th>
            <th className="px-2 py-1">משקל %</th>
            <th className="px-2 py-1">רמז לשופטת</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, i) => (
            <tr key={c.key || i} className="border-t border-ink-200">
              <td className="px-2 py-1.5">
                <input className={`${input} w-full`} value={c.label} onChange={(e) => setCriteria((cs) => cs.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} placeholder="שם הקריטריון" />
              </td>
              <td className="px-2 py-1.5">
                <input className={`${input} w-24`} type="number" min={0} max={100} step={0.5} value={c.weight} onChange={(e) => setCriteria((cs) => cs.map((x, k) => (k === i ? { ...x, weight: Number(e.target.value) } : x)))} />
              </td>
              <td className="px-2 py-1.5">
                <input className={`${input} w-full`} value={c.hint} onChange={(e) => setCriteria((cs) => cs.map((x, k) => (k === i ? { ...x, hint: e.target.value } : x)))} placeholder="רמז קצר" />
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
      <div className="flex gap-2">
        <button className={quiet} onClick={() => setCriteria((cs) => [...cs, { key: "", label: "", weight: 0, hint: "" }])}>
          + קריטריון
        </button>
        <button className={btn} disabled={busy} onClick={save}>
          שמרי שקלול
        </button>
      </div>
      <Note m={msg} />
    </div>
  );
}

function QuestionsCard({ view, api, busy }: { view: LiveAdminView; api: Api; busy: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [opts, setOpts] = useState<string[]>(["", "", "", ""]);
  const [reveal, setReveal] = useState<"live" | "end">("live");
  const [msg, setMsg] = useState<Msg>(null);
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
  return (
    <div className={card}>
      <h2 className="font-display font-bold text-ink-1000">{editing ? "עריכת שאלה" : "שאלה חדשה"} <span className="text-[12px] font-mono text-brand-pink-deep">&lt;שאלות הקהל בטלפון/&gt;</span></h2>
      <div className="grid md:grid-cols-[3fr_auto] gap-3 items-end">
        <label className="flex flex-col gap-1 text-[12px] text-ink-700 font-semibold">
          טקסט השאלה (כפי שיופיע על המסך)
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
                {item.challengeKey ? "🏆 " : ""}
                {item.reveal === "end" ? "👁 " : ""}
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
                  <button className={quiet} disabled={busy || i === 0} onClick={() => act({ action: "question-move", id: item.id, direction: "up" })} title="למעלה">
                    ▲
                  </button>
                  <button className={quiet} disabled={busy || i === view.questions.length - 1} onClick={() => act({ action: "question-move", id: item.id, direction: "down" })} title="למטה">
                    ▼
                  </button>
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
    </div>
  );
}

function SettingsCard({ view, api, busy }: { view: LiveAdminView; api: Api; busy: boolean }) {
  const s = view.settings;
  const [eventName, setEventName] = useState(s.eventName);
  const [phone, setPhone] = useState(s.phoneDisplay);
  const [token, setToken] = useState("");
  const [ext, setExt] = useState(s.yemotExtension);
  const [theme, setTheme] = useState(s.theme);
  const [msg, setMsg] = useState<Msg>(null);
  const [test, setTest] = useState<Msg>(null);
  const save = async () => {
    try {
      await api({ action: "settings", eventName, phoneDisplay: phone, yemotToken: token || undefined, yemotExtension: ext, theme });
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
    <div className={card}>
      <h2 className="font-display font-bold text-ink-1000">חיבור לימות המשיח ומסך האולם</h2>
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
          ערכת המסך
          <select className={input} value={theme} onChange={(e) => setTheme(e.target.value as "light" | "dark")}>
            <option value="light">בהירה</option>
            <option value="dark">כהה למקרן</option>
          </select>
        </label>
        <button className={btn} disabled={busy} onClick={save}>
          שמרי
        </button>
        <button className={ghost} disabled={busy || !s.hasToken} onClick={runTest}>
          בדקי חיבור
        </button>
      </div>
      <Note m={msg} />
      <Note m={test} />
      <p className="text-[12px] text-ink-500">השלוחה צריכה להיות מסוג ״קבלת נתונים״ שחוזרת לעצמה, עם זיהוי לפי מספר המתקשר. המפתח נשמר בשרת בלבד ולא מגיע לדפדפן.</p>
    </div>
  );
}
