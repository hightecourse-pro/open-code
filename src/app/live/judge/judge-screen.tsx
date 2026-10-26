"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { judgeTotal, type LiveJudgeView } from "@/lib/hackathon-live-shared";

const POLL_MS = 2500;

/* The judge's page (the owner, 26/10): every contestant of her challenge on
   one page, her criteria under each name, 1-10 a tap - nothing else. */
const CSS = `
.jg{min-height:100vh;background:#f6f4fa;color:#11102a;font-family:var(--font-noto-hebrew),"Noto Sans Hebrew",system-ui,sans-serif;padding-bottom:84px;-webkit-font-smoothing:antialiased;--grad:linear-gradient(95deg,#e0418d 0%,#913f80 50%,#464ca0 100%)}
.jg .stripe{height:5px;background:linear-gradient(120deg,#ffd166 0%,#e0418d 33%,#913f80 66%,#464ca0 100%)}
.jg header{background:#fff;border-bottom:1px solid #e2e2ec;padding:10px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:5}
.jg header img{height:42px;width:auto}
.jg .who{flex:1;min-width:0}
.jg .who b{display:block;font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jg .who span{display:block;font-size:13px;color:#6e6e8a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jg .pill{display:inline-flex;align-items:center;gap:6px;border-radius:9999px;padding:4px 12px;font-size:13px;font-weight:700;border:1px solid #e2e2ec;background:#f3eff8;color:#3a3a5c;white-space:nowrap}
.jg .pill i{width:8px;height:8px;border-radius:50%;background:#6e6e8a}
.jg .pill.open{color:#1f9d6a;border-color:#1f9d6a;background:#e8f6ef} .jg .pill.open i{background:#1f9d6a}
.jg .pill.closed{color:#ce2462;border-color:#e0418d;background:#fdecf3} .jg .pill.closed i{background:#e0418d}
.jg main{max-width:640px;margin:0 auto;padding:14px 14px 0;display:flex;flex-direction:column;gap:14px}
.jg .note{font-size:14px;color:#3a3a5c;background:#fff;border:1px solid #e2e2ec;border-radius:16px;padding:12px 14px}
.jg .card{background:#fff;border:1px solid #e2e2ec;border-radius:20px;padding:16px;box-shadow:0 2px 8px #2e2e6e12}
.jg .card.now{outline:2px solid #e0418d}
.jg .card .name{font-size:22px;font-weight:900;line-height:1.2;margin:0 0 4px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.jg .card .name .n{width:30px;height:30px;border-radius:10px;background:var(--grad);color:#fff;display:grid;place-items:center;font-size:15px;flex:none}
.jg .card .name .live{font-size:11px;font-weight:800;color:#ce2462;border:1.5px solid #e0418d;border-radius:9999px;padding:1px 9px}
.jg .crit{padding:12px 0;border-top:1px solid #e2e2ec}
.jg .crit .head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.jg .crit .head b{font-size:16px}
.jg .crit .w{font-size:12px;font-weight:700;color:#6b3d99;background:#f2ebf7;border-radius:9999px;padding:1px 9px}
.jg .crit .hint{font-size:13px;color:#6e6e8a;margin:2px 0 8px}
.jg .scale{display:grid;grid-template-columns:repeat(10,1fr);gap:5px}
.jg .scale button{font-family:inherit;font-size:16px;font-weight:700;height:44px;border-radius:10px;border:1.5px solid #e2e2ec;background:#f3eff8;color:#3a3a5c;cursor:pointer;padding:0;touch-action:manipulation}
.jg .scale button.on{background:var(--grad);color:#fff;border-color:transparent;box-shadow:0 4px 12px #913f8040}
.jg .scale button:disabled{opacity:.5;cursor:default}
@media (max-width:380px){.jg .scale{grid-template-columns:repeat(5,1fr)}.jg .scale button{height:42px}}
.jg .total{display:flex;align-items:center;gap:12px;margin-top:10px;padding-top:12px;border-top:1px solid #e2e2ec;font-size:13px;color:#6e6e8a}
.jg .total .big{font-size:28px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums;direction:ltr;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.jg .total .big small{font-size:14px;color:#6e6e8a;-webkit-text-fill-color:#6e6e8a;font-weight:600}
.jg .total b{color:#11102a}
.jg .save{position:fixed;bottom:0;inset-inline:0;background:#fff;border-top:1px solid #e2e2ec;padding:10px 16px calc(10px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:10px;font-size:14px;z-index:5}
.jg .save i{width:10px;height:10px;border-radius:50%;background:#6e6e8a;flex:none}
.jg .save.ok i{background:#1f9d6a} .jg .save.err i{background:#d8345f} .jg .save.busy i{background:#c77800;animation:jgblink 1s infinite}
@keyframes jgblink{50%{opacity:.4}}
.jg .save .txt{flex:1}
.jg .save button{font-family:inherit;font-size:13px;background:none;border:0;color:#6b3d99;text-decoration:underline;cursor:pointer}
`;

type Scores = Record<string, number>;

export function JudgeScreen({ token, initial, onLeave }: { token: string; initial: LiveJudgeView | null; onLeave?: () => void }) {
  const [view, setView] = useState<LiveJudgeView | null>(initial);
  const [local, setLocal] = useState<Map<string, Scores>>(() => new Map());
  const [save, setSave] = useState<{ kind: "" | "ok" | "err" | "busy"; text: string }>({ kind: "", text: "הציונים נשמרים אוטומטית" });
  const [offline, setOffline] = useState(false);
  const [gone, setGone] = useState(false);
  const pending = useRef<Map<string, Scores>>(new Map());
  const saving = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/hackathon/live/judge/${encodeURIComponent(token)}`, { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as LiveJudgeView | { ok: false; error: string } | null;
      if (r.status === 404) {
        setGone(true);
        return;
      }
      if (!r.ok || !j || !j.ok) return;
      setOffline(false);
      setView(j);
    } catch {
      setOffline(true);
    }
  }, [token]);

  useEffect(() => {
    const first = initial ? null : setTimeout(load, 0);
    const t = setInterval(() => {
      if (!pending.current.size && !saving.current) load();
    }, POLL_MS);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (first) clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, initial]);

  const flush = useCallback(async () => {
    if (saving.current || !pending.current.size) return;
    saving.current = true;
    const [id, scores] = pending.current.entries().next().value as [string, Scores];
    pending.current.delete(id);
    setSave({ kind: "busy", text: "שומרת…" });
    try {
      const r = await fetch(`/api/hackathon/live/judge/${encodeURIComponent(token)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ finalistId: id, scores }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; scores?: Scores } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "השמירה נכשלה");
      // what the server holds now stays the base for the next tap - a tap that lands while the
      // page is still reloading must build on it, not on a stale snapshot (fast taps lost scores)
      if (!pending.current.has(id)) setLocal((m) => new Map(m).set(id, j.scores ?? scores));
      setSave({ kind: "ok", text: "נשמר ✓ " + new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) });
    } catch (err) {
      pending.current.set(id, scores);
      setSave({ kind: "err", text: (err as Error).message + " - ינסה שוב" });
      saving.current = false;
      setTimeout(() => flushRef.current(), 3000);
      return;
    }
    saving.current = false;
    if (pending.current.size) flushRef.current();
    else load();
  }, [token, load]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  if (gone) {
    return (
      <div className="jg" dir="rtl">
        <style>{CSS}</style>
        <main>
          <div className="note">
            הרישום שלך לא נמצא. {onLeave ? <button type="button" style={{ font: "inherit", background: "none", border: 0, color: "#6b3d99", textDecoration: "underline" }} onClick={onLeave}>להיכנס מחדש</button> : "בקשי מהמארגנת קישור חדש."}
          </div>
        </main>
      </div>
    );
  }

  const ch = view?.challenge ?? null;
  const finalists = view?.finalists ?? [];
  const scoresOf = (id: string): Scores => local.get(id) ?? finalists.find((f) => f.id === id)?.scores ?? {};
  const open = ch?.status === "judging";

  const tap = (fid: string, key: string, val: number) => {
    if (!open) return;
    const next: Scores = { ...scoresOf(fid) };
    if (next[key] === val) delete next[key];
    else next[key] = val;
    setLocal((m) => new Map(m).set(fid, next));
    pending.current.set(fid, next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 350);
  };

  return (
    <div className="jg" dir="rtl">
      <style>{CSS}</style>
      <div className="stripe" />
      <header>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hackathon-2026/logo-hackathon.png" alt="האקתון AI 2026" />
        <div className="who">
          <b>{view?.judge.name ?? "…"}</b>
          <span>{ch ? ch.name : view ? "עוד לא שובצת לאתגר" : "טוענת…"}</span>
        </div>
        <span className={`pill ${ch?.status === "judging" ? "open" : ch?.status === "closed" ? "closed" : ""}`}>
          <i />
          <span>{ch?.status === "judging" ? "השיפוט פתוח" : ch?.status === "closed" ? "השיפוט נסגר" : "עוד לא נפתח"}</span>
        </span>
      </header>
      <main>
        {!view ? null : !ch ? (
          <div className="note">המארגנת עוד לא פתחה את האתגר הזה. הדף יתעדכן לבד.</div>
        ) : !finalists.length ? (
          <div className="note">עוד אין מתמודדות באתגר הזה. הדף יתעדכן לבד.</div>
        ) : (
          <>
            {!open ? <div className="note">{ch.status === "closed" ? "השיפוט באתגר הזה נסגר - הציונים נעולים." : "השיפוט עוד לא נפתח. ברגע שהמארגנת תפתח אותו, אפשר יהיה לדרג כאן."}</div> : null}
            {finalists.map((f) => {
              const s = scoresOf(f.id);
              const t = judgeTotal(s, view.criteria, view.scale);
              return (
                <section key={f.id} className={`card${f.id === ch.currentId ? " now" : ""}`} data-id={f.id}>
                  <h2 className="name">
                    <span className="n">{f.n}</span>
                    <span>{f.name}</span>
                    {f.id === ch.currentId ? <span className="live">מציגות עכשיו</span> : null}
                  </h2>
                  {view.criteria.map((c) => (
                    <div className="crit" key={c.key}>
                      <div className="head">
                        <b>{c.label}</b>
                        <span className="w">{c.weight}%</span>
                      </div>
                      {c.hint ? <div className="hint">{c.hint}</div> : null}
                      <div className="scale">
                        {Array.from({ length: view.scale }, (_, i) => (
                          <button key={i} type="button" className={s[c.key] === i + 1 ? "on" : ""} disabled={!open} onClick={() => tap(f.id, c.key, i + 1)}>
                            {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="total">
                    <div className="big">
                      <span>{t.total}</span>
                      <small> / {view.maxTotal}</small>
                    </div>
                    <span>
                      {t.complete ? (
                        <b>הציון נשמר</b>
                      ) : (
                        <>
                          דורגו <b>{t.filled}</b> מתוך {view.criteria.length}
                        </>
                      )}
                    </span>
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>
      <div className={`save ${offline ? "err" : save.kind}`}>
        <i />
        <span className="txt">{offline ? "אין חיבור לשרת - מנסה שוב…" : save.text}</span>
        {onLeave ? (
          <button type="button" onClick={onLeave}>
            שופטת אחרת
          </button>
        ) : null}
      </div>
    </div>
  );
}
