"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { judgeTotal, type LiveJudgeView } from "@/lib/hackathon-live-shared";

const POLL_MS = 2500;

const CSS = `
.jg{min-height:100vh;background:#f6f4fa;color:#11102a;font-family:var(--font-noto-hebrew),"Noto Sans Hebrew",system-ui,sans-serif;padding-bottom:96px;-webkit-font-smoothing:antialiased;--grad:linear-gradient(95deg,#e0418d 0%,#913f80 50%,#464ca0 100%)}
.jg .stripe{height:5px;background:linear-gradient(120deg,#ffd166 0%,#e0418d 33%,#913f80 66%,#464ca0 100%)}
.jg header{background:#fff;border-bottom:1px solid #e2e2ec;padding:10px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:5}
.jg header img{height:44px;width:auto}
.jg .who{flex:1;min-width:0}
.jg .who b{display:block;font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jg .who span{display:block;font-size:13px;color:#6e6e8a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jg .pill{display:inline-flex;align-items:center;gap:6px;border-radius:9999px;padding:4px 12px;font-size:13px;font-weight:700;border:1px solid #e2e2ec;background:#f3eff8;color:#3a3a5c;white-space:nowrap}
.jg .pill i{width:8px;height:8px;border-radius:50%;background:#6e6e8a}
.jg .pill.open{color:#1f9d6a;border-color:#1f9d6a;background:#e8f6ef} .jg .pill.open i{background:#1f9d6a}
.jg .pill.closed{color:#ce2462;border-color:#e0418d;background:#fdecf3} .jg .pill.closed i{background:#e0418d}
.jg main{max-width:640px;margin:0 auto;padding:14px 14px 0}
.jg .ch{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e2e2ec;border-radius:18px;padding:12px 14px;margin-bottom:12px}
.jg .ch .logos{display:flex;gap:8px;align-items:center}
.jg .ch .logos img{height:30px;width:auto;max-width:90px;object-fit:contain}
.jg .ch h1{margin:0;font-size:17px;font-weight:800;flex:1}
.jg .ch h1 small{display:block;font-size:12px;font-weight:500;color:#6e6e8a}
.jg .chips{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 10px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.jg .chips::-webkit-scrollbar{display:none}
.jg .chip{flex:none;border:1.5px solid #e2e2ec;background:#fff;border-radius:14px;padding:8px 12px;font-size:14px;font-weight:600;color:#3a3a5c;cursor:pointer;display:flex;align-items:center;gap:8px;max-width:72vw;font-family:inherit}
.jg .chip .n{width:24px;height:24px;border-radius:8px;background:#f3eff8;display:grid;place-items:center;font-weight:800;font-size:13px;color:#6b3d99;flex:none}
.jg .chip .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jg .chip.done .n{background:#e8f6ef;color:#1f9d6a}
.jg .chip.sel{border-color:#6b3d99;background:#f2ebf7;color:#11102a}
.jg .chip.now{box-shadow:0 0 0 2px #e0418d55}
.jg .chip .live{font-size:10px;font-weight:800;color:#fff;background:#e0418d;border-radius:9999px;padding:1px 7px;flex:none}
.jg .card{background:#fff;border:1px solid #e2e2ec;border-radius:20px;padding:16px;box-shadow:0 2px 8px #2e2e6e12}
.jg .card .name{font-size:22px;font-weight:900;line-height:1.2;margin:0}
.jg .card .team{color:#6e6e8a;font-size:14px;margin:2px 0 14px}
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
.jg .total{display:flex;align-items:center;gap:14px;margin-top:14px;padding-top:14px;border-top:1px solid #e2e2ec}
.jg .total .big{font-size:38px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums;direction:ltr;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.jg .total .big small{font-size:16px;color:#6e6e8a;-webkit-text-fill-color:#6e6e8a;font-weight:600}
.jg .total .st{flex:1;font-size:13px;color:#6e6e8a}
.jg .total .st b{color:#11102a}
.jg .nav{display:flex;gap:8px;margin-top:12px}
.jg .nav button{flex:1;font-family:inherit;font-size:15px;font-weight:700;padding:12px;border-radius:14px;border:1.5px solid #6b3d99;background:#fff;color:#6b3d99;cursor:pointer}
.jg .nav button:disabled{opacity:.4}
.jg .save{position:fixed;bottom:0;inset-inline:0;background:#fff;border-top:1px solid #e2e2ec;padding:10px 16px calc(10px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:10px;font-size:14px;z-index:5}
.jg .save i{width:10px;height:10px;border-radius:50%;background:#6e6e8a;flex:none}
.jg .save.ok i{background:#1f9d6a} .jg .save.err i{background:#d8345f} .jg .save.busy i{background:#c77800;animation:jgblink 1s infinite}
@keyframes jgblink{50%{opacity:.4}}
.jg .msg{background:#fff;border:1px solid #e2e2ec;border-radius:16px;padding:18px;text-align:center;color:#3a3a5c;margin-top:12px}
.jg .toast{position:fixed;top:72px;inset-inline:14px;background:#11102a;color:#fff;border-radius:14px;padding:12px 16px;font-size:14px;z-index:9;box-shadow:0 10px 30px #00000040;display:flex;align-items:center;gap:10px}
.jg .toast button{font-family:inherit;background:#e0418d;color:#fff;border:0;border-radius:9999px;padding:6px 14px;font-weight:700;font-size:13px;cursor:pointer;margin-inline-start:auto}
`;

type Scores = Record<string, number>;

export function JudgeScreen({ token, initial }: { token: string; initial: LiveJudgeView }) {
  const [view, setView] = useState<LiveJudgeView>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial.challenge?.currentId ?? initial.finalists[0]?.id ?? null);
  const [local, setLocal] = useState<Map<string, Scores>>(() => new Map());
  const [save, setSave] = useState<{ kind: "" | "ok" | "err" | "busy"; text: string }>({ kind: "", text: "הציונים נשמרים אוטומטית" });
  const [toast, setToast] = useState<{ id: string; name: string } | null>(null);
  const [offline, setOffline] = useState(false);
  const lastCurrent = useRef<string | null>(initial.challenge?.currentId ?? null);
  const pending = useRef<Map<string, Scores>>(new Map());
  const saving = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // the retry after a failed save calls the latest flush through this ref
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/hackathon/live/judge/${encodeURIComponent(token)}`, { cache: "no-store" });
      const j = (await r.json().catch(() => null)) as LiveJudgeView | { ok: false; error: string } | null;
      if (!r.ok || !j || !j.ok) return;
      setOffline(false);
      setView(j);
      const cur = j.challenge?.currentId ?? null;
      if (cur && cur !== lastCurrent.current) {
        lastCurrent.current = cur;
        setSelectedId((sel) => {
          if (sel && sel !== cur) {
            const f = j.finalists.find((x) => x.id === cur);
            if (f) setToast({ id: cur, name: f.name });
            return sel;
          }
          return cur;
        });
      }
    } catch {
      setOffline(true);
    }
  }, [token]);

  useEffect(() => {
    const t = setInterval(() => {
      if (!pending.current.size && !saving.current) load();
    }, POLL_MS);
    const onVis = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const flush = useCallback(async () => {
    if (saving.current || !pending.current.size) return;
    saving.current = true;
    const [id, scores] = pending.current.entries().next().value as [string, Scores];
    pending.current.delete(id);
    setSave({ kind: "busy", text: "שומרת…" });
    try {
      const r = await fetch(`/api/hackathon/live/judge/${encodeURIComponent(token)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ finalistId: id, scores }) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? "השמירה נכשלה");
      if (!pending.current.has(id)) setLocal((m) => {
        const next = new Map(m);
        next.delete(id);
        return next;
      });
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

  const ch = view.challenge;
  const finalists = view.finalists;
  const selected = finalists.find((f) => f.id === selectedId) ?? finalists[0] ?? null;
  const scoresOf = (id: string): Scores => local.get(id) ?? finalists.find((f) => f.id === id)?.scores ?? {};
  const open = ch?.status === "judging";

  const tap = (key: string, val: number) => {
    if (!selected || !open) return;
    const next: Scores = { ...scoresOf(selected.id) };
    if (next[key] === val) delete next[key];
    else next[key] = val;
    setLocal((m) => new Map(m).set(selected.id, next));
    pending.current.set(selected.id, next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 350);
  };

  const idx = selected ? finalists.findIndex((f) => f.id === selected.id) : -1;
  const t = selected ? judgeTotal(scoresOf(selected.id), view.criteria, view.scale) : null;

  return (
    <div className="jg" dir="rtl">
      <style>{CSS}</style>
      <div className="stripe" />
      <header>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hackathon-2026/logo-hackathon.png" alt="האקתון AI 2026" />
        <div className="who">
          <b>{view.judge.name}</b>
          <span>{ch ? ch.name : "עוד לא שובצת לאתגר"}</span>
        </div>
        <span className={`pill ${ch?.status === "judging" ? "open" : ch?.status === "closed" ? "closed" : ""}`}>
          <i />
          <span>{ch?.status === "judging" ? "השיפוט פתוח" : ch?.status === "closed" ? "השיפוט נסגר" : "עוד לא נפתח"}</span>
        </span>
      </header>
      <main>
        {!ch ? (
          <div className="msg">המארגנת עוד לא שיבצה אותך לאתגר. המסך יתעדכן לבד.</div>
        ) : (
          <>
            <div className="ch">
              <div className="logos">
                {ch.logos.map((l) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={l} src={l} alt="" />
                ))}
              </div>
              <h1>
                {ch.name}
                <small>{ch.org}</small>
              </h1>
            </div>
            {!finalists.length ? (
              <div className="msg">עוד אין סופיות באתגר הזה.</div>
            ) : (
              <>
                <div className="chips">
                  {finalists.map((f) => {
                    const ft = judgeTotal(scoresOf(f.id), view.criteria, view.scale);
                    return (
                      <button key={f.id} type="button" className={`chip${f.id === selected?.id ? " sel" : ""}${ft.complete ? " done" : ""}${f.id === ch.currentId ? " now" : ""}`} onClick={() => setSelectedId(f.id)}>
                        <span className="n">{ft.complete ? "✓" : f.n}</span>
                        <span className="t">{f.name}</span>
                        {f.id === ch.currentId ? <span className="live">מציגות</span> : null}
                      </button>
                    );
                  })}
                </div>
                {selected && t ? (
                  <section className="card">
                    <h2 className="name">{selected.name}</h2>
                    <div className="team">{selected.team}</div>
                    {view.criteria.map((c) => {
                      const s = scoresOf(selected.id);
                      return (
                        <div className="crit" key={c.key}>
                          <div className="head">
                            <b>{c.label}</b>
                            <span className="w">{c.weight}%</span>
                          </div>
                          {c.hint ? <div className="hint">{c.hint}</div> : null}
                          <div className="scale">
                            {Array.from({ length: view.scale }, (_, i) => (
                              <button key={i} type="button" className={s[c.key] === i + 1 ? "on" : ""} disabled={!open} onClick={() => tap(c.key, i + 1)}>
                                {i + 1}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <div className="total">
                      <div className="big">
                        <span>{t.total}</span>
                        <small> / 100</small>
                      </div>
                      <div className="st">
                        {t.complete ? (
                          <>
                            <b>הציון המשוקלל נשמר</b> · {view.criteria.length} קריטריונים
                          </>
                        ) : (
                          <>
                            דורגו <b>{t.filled}</b> מתוך {view.criteria.length} קריטריונים{open ? "" : " · השיפוט לא פתוח כרגע"}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="nav">
                      <button type="button" disabled={idx <= 0} onClick={() => setSelectedId(finalists[idx - 1].id)}>
                        ◀ הקודמת
                      </button>
                      <button type="button" disabled={idx >= finalists.length - 1} onClick={() => setSelectedId(finalists[idx + 1].id)}>
                        הבאה ▶
                      </button>
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </>
        )}
      </main>
      <div className={`save ${offline ? "err" : save.kind}`}>
        <i />
        <span>{offline ? "אין חיבור לשרת - מנסה שוב…" : save.text}</span>
      </div>
      {toast ? (
        <div className="toast">
          <span>עכשיו מציגות: {toast.name}</span>
          <button
            type="button"
            onClick={() => {
              setSelectedId(toast.id);
              setToast(null);
            }}
          >
            עברי אליה
          </button>
        </div>
      ) : null}
    </div>
  );
}
