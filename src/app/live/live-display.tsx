"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveDisplayView, LiveFinalsView, LiveQuestionView } from "@/lib/hackathon-live-shared";

const POLL_MS = 2000;

/* One idea per screen, one chart at a time (the owner, 26/10: "מינימליסטי"). */
const CSS = `
.lv{position:fixed;inset:0;display:flex;flex-direction:column;overflow:hidden;font-family:var(--font-noto-hebrew),"Noto Sans Hebrew",system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  --pink:#e0418d;--pink-deep:#ce2462;--purple:#6b3d99;--grad:linear-gradient(95deg,#e0418d 0%,#913f80 50%,#464ca0 100%);
  --page:#fbfafd;--surface:#fff;--line:#e7e5ef;--txt:#15132b;--txt2:#4a4868;--muted:#7a7892;--track:#efedf6;--success:#1f9d6a;--danger:#d8345f;
  background:var(--page);color:var(--txt);cursor:none}
.lv[data-theme="dark"]{--page:#12102a;--surface:#1c1a3a;--line:#34325a;--txt:#fff;--txt2:#d6d4e8;--muted:#9a98b8;--track:#2a2850}
.lv.cursor{cursor:default}
.lv>*{position:relative}
.stripe{height:5px;background:var(--grad);flex:none}
.hd{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:clamp(8px,1.4vh,18px) clamp(18px,3vw,52px)}
.brand{display:flex;align-items:center;gap:18px;min-width:0}
.brand .ev{height:clamp(40px,7vh,88px);width:auto;display:block}
.lv[data-theme="dark"] .brand .ev{background:#fff;border-radius:14px;padding:4px 10px}
.brand .name{font-size:clamp(15px,1.9vw,26px);font-weight:600;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.phone{display:flex;align-items:baseline;gap:12px;white-space:nowrap}
.phone .l{font-size:clamp(13px,1.4vw,20px);color:var(--txt2);font-weight:600}
.phone .n{font-size:clamp(24px,3.2vw,50px);font-weight:900;letter-spacing:.03em;direction:ltr;font-variant-numeric:tabular-nums;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.mn{flex:1;display:flex;flex-direction:column;padding:clamp(10px,2vh,30px) clamp(24px,5vw,96px);min-height:0}
.idle{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:clamp(10px,2vh,28px)}
.idle .logo{height:clamp(90px,20vh,240px);width:auto}
.lv[data-theme="dark"] .idle .logo{background:#fff;border-radius:22px;padding:10px 20px}
.idle .big{font-size:clamp(26px,4.6vw,72px);font-weight:900}
.idle .num{font-size:clamp(40px,9vw,160px);font-weight:900;letter-spacing:.04em;direction:ltr;line-height:1;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.idle .sub{font-size:clamp(16px,2.2vw,30px);color:var(--txt2)}
.kick{display:inline-block;font-size:clamp(13px,1.7vh,22px);font-weight:700;color:var(--pink-deep);letter-spacing:.02em}
.lv[data-theme="dark"] .kick{color:#ff8ac0}
.ttl{font-size:clamp(28px,4.8vw,80px);font-weight:900;line-height:1.12;margin:4px 0 clamp(14px,3vh,40px);letter-spacing:-.01em;max-height:30vh;overflow:hidden}
.ttl.long{font-size:clamp(22px,3.4vw,56px)}
.chart{flex:1;display:flex;flex-direction:column;justify-content:center;gap:clamp(10px,2.2vh,30px);min-height:0}
.r{display:grid;grid-template-columns:auto minmax(220px,.9fr) 2fr auto;align-items:center;gap:clamp(12px,1.8vw,30px)}
.r .k{width:clamp(34px,4.4vh,64px);height:clamp(34px,4.4vh,64px);border-radius:999px;border:2px solid var(--line);display:grid;place-items:center;font-weight:800;font-size:clamp(16px,2.4vh,32px);color:var(--txt2);font-variant-numeric:tabular-nums}
.r.first .k{background:var(--grad);color:#fff;border-color:transparent}
.r .nm{font-size:clamp(18px,2.8vh,42px);font-weight:700;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.r .nm small{display:block;font-size:.5em;font-weight:500;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.r .nm .now{display:inline-block;font-size:.42em;font-weight:700;color:var(--pink-deep);border:1.5px solid var(--pink);border-radius:999px;padding:0 10px;margin-inline-start:10px;vertical-align:middle}
.r .tr{height:clamp(14px,2.6vh,36px);background:var(--track);border-radius:999px;overflow:hidden;position:relative}
.r .fl{position:absolute;inset:0 0 0 auto;width:0;height:100%;background:var(--grad);border-radius:999px;transition:width .8s cubic-bezier(.22,1,.36,1)}
.r .fl.nz{min-width:clamp(14px,2.6vh,36px)}
.r .v{font-size:clamp(20px,3.4vh,52px);font-weight:900;min-width:4.5ch;text-align:left;direction:ltr;font-variant-numeric:tabular-nums;white-space:nowrap}
.r .v small{font-size:.5em;font-weight:600;color:var(--muted);margin-inline-start:6px}
.tiles{flex:1;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:clamp(12px,2vw,32px)}
.tile{display:flex;align-items:center;gap:clamp(12px,1.6vw,24px);flex:0 1 calc((100% - (var(--cols) - 1) * clamp(12px,2vw,32px)) / var(--cols));min-width:200px;padding:clamp(14px,2.4vh,30px) clamp(16px,2vw,30px);border-radius:24px;background:var(--surface);border:1px solid var(--line)}
.tile .k{width:clamp(48px,7.5vh,96px);height:clamp(48px,7.5vh,96px);border-radius:22px;background:var(--grad);color:#fff;display:grid;place-items:center;font-weight:900;font-size:clamp(24px,4.4vh,56px);flex:none}
.tile .nm{font-size:clamp(18px,2.8vh,40px);font-weight:700;line-height:1.15}
.tile .nm small{display:block;font-size:.55em;font-weight:500;color:var(--muted)}
.wait{font-size:clamp(16px,2.4vh,32px);color:var(--txt2);text-align:center;margin-top:clamp(10px,2vh,24px)}
.wait b{color:var(--txt);font-variant-numeric:tabular-nums}
.cats{display:flex;flex-wrap:wrap;gap:clamp(10px,1.4vw,24px) clamp(18px,2.6vw,44px);justify-content:center;font-size:clamp(13px,1.9vh,24px);color:var(--txt2);margin-top:clamp(8px,1.6vh,20px)}
.cats b{color:var(--txt)}
.ft{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:clamp(8px,1.4vh,18px) clamp(24px,5vw,96px);border-top:1px solid var(--line);font-size:clamp(13px,1.8vh,24px);color:var(--txt2)}
.ft b{color:var(--txt);font-variant-numeric:tabular-nums}
.pill{display:inline-flex;align-items:center;gap:8px;font-weight:700}
.pill i{width:.6em;height:.6em;border-radius:50%;background:var(--muted)}
.pill.open i{background:var(--success);animation:lvpulse 1.6s infinite} .pill.closed i{background:var(--pink)}
@keyframes lvpulse{0%{box-shadow:0 0 0 0 #1f9d6a88}70%{box-shadow:0 0 0 .5em #1f9d6a00}100%{box-shadow:0 0 0 0 #1f9d6a00}}
.net{position:absolute;bottom:6px;left:12px;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;opacity:.8}
.net i{width:8px;height:8px;border-radius:50%;background:var(--success)} .net.bad i{background:var(--danger)} .net.warn i{background:#c77800}
.toast{position:absolute;top:14px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:8px 16px;font-size:15px}
`;

const fmt = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("he-IL");

/** The audience vote on a category, or any question: numbers to press while open, bars once closed. */
function QuestionScreen({ q, voted, visible }: { q: LiveQuestionView; voted: number; visible: boolean }) {
  const title = q.category ? q.category.label : q.text;
  const max = Math.max(1, ...q.options.map((o) => o.count ?? 0));
  return (
    <>
      <span className="kick">{q.category ? `הצבעת הקהל · ${q.category.challenge}` : "הצבעת הקהל"}</span>
      <h1 className={`ttl${title.length > 70 ? " long" : ""}`}>{title}</h1>
      {!visible ? (
        <>
          <div className="tiles" style={{ ["--cols" as string]: q.options.length <= 3 ? q.options.length : q.options.length <= 6 ? 3 : 3 }}>
            {q.options.map((o) => (
              <div key={o.n} className="tile">
                <div className="k">{o.n}</div>
                <div className="nm">{o.label}</div>
              </div>
            ))}
          </div>
          <div className="wait">
            הקישו את המספר בטלפון · הצביעו <b>{fmt(voted)}</b>
          </div>
        </>
      ) : (
        <div className="chart">
          {q.options.map((o) => {
            const count = o.count ?? 0;
            const first = voted > 0 && o.leading && q.options.filter((x) => x.leading).length === 1;
            return (
              <div key={o.n} className={`r${first ? " first" : ""}`}>
                <span className="k">{o.n}</span>
                <div className="nm">{o.label}</div>
                <div className="tr">
                  <div className={`fl${count > 0 ? " nz" : ""}`} style={{ width: `${((count / max) * 100).toFixed(1)}%` }} />
                </div>
                <div className="v">
                  {voted ? `${Math.round(o.pct ?? 0)}%` : "—"}
                  <small>{fmt(count)}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/** The finals board: one bar per project, the total at its end, the audience's picks underneath. */
function FinalsScreen({ f }: { f: LiveFinalsView }) {
  const rows = f.finalists ?? [];
  const max = Math.max(1, ...rows.map((x) => x.total ?? 0));
  const ranked = !f.hidden && rows.some((x) => x.rank);
  return (
    <>
      <span className="kick">גמר ההאקתון</span>
      <h1 className="ttl">{f.name}</h1>
      {f.hidden ? (
        <>
          <div className="tiles" style={{ ["--cols" as string]: rows.length <= 3 ? rows.length : 3 }}>
            {rows.map((x) => (
              <div key={x.id} className="tile">
                <div className="k">{x.n}</div>
                <div className="nm">
                  {x.name}
                  {x.team ? <small>{x.team}</small> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="wait">התוצאות ייחשפו בסיום</div>
        </>
      ) : (
        <div className="chart">
          {rows.map((x, i) => (
            <div key={x.id} className={`r${ranked && x.rank === 1 ? " first" : ""}`} style={{ order: ranked && x.rank ? x.rank : 100 + i }}>
              <span className="k">{ranked && x.rank ? x.rank : x.n}</span>
              <div className="nm">
                {x.name}
                {x.id === f.currentId ? <span className="now">מציגות עכשיו</span> : null}
                {x.team ? <small>{x.team}</small> : null}
              </div>
              <div className="tr">
                <div className={`fl${(x.total ?? 0) > 0 ? " nz" : ""}`} style={{ width: `${(((x.total ?? 0) / max) * 100).toFixed(1)}%` }} />
              </div>
              <div className="v">{x.total === null || x.total === undefined ? "—" : x.total}</div>
            </div>
          ))}
        </div>
      )}
      {!f.hidden && f.categories?.some((c) => c.winner) ? (
        <div className="cats">
          {f.categories
            .filter((c) => c.winner)
            .map((c) => (
              <span key={c.key}>
                {c.label}: <b>{c.winner}</b>
              </span>
            ))}
        </div>
      ) : null}
    </>
  );
}

export function LiveDisplay({ initial, isAdmin, forcedTheme }: { initial: LiveDisplayView; isAdmin: boolean; forcedTheme: "light" | "dark" | null }) {
  const [view, setView] = useState<LiveDisplayView>(initial);
  const [sessionTheme, setSessionTheme] = useState<"light" | "dark" | null>(null);
  const [lastOk, setLastOk] = useState<number>(() => Date.now());
  const [stale, setStale] = useState(false);
  const [cursor, setCursor] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/hackathon/live/view", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setView((await r.json()) as LiveDisplayView);
      setLastOk(Date.now());
      setStale(false);
    } catch {
      setStale(Date.now() - lastOk > 15000);
    }
  }, [lastOk]);

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const control = useCallback(
    async (op: string) => {
      if (!isAdmin) return;
      try {
        const r = await fetch("/api/admin/hackathon/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "control", op }) });
        const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!j?.ok) setToast(j?.error ?? "שגיאה");
        else refresh();
      } catch {
        setToast("אין חיבור לשרת");
      }
      setTimeout(() => setToast(null), 1800);
    },
    [isAdmin, refresh]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyF" || e.code === "F11") {
        e.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
        return;
      }
      if (e.code === "KeyT") {
        setSessionTheme((t) => ((t ?? forcedTheme ?? view.event.theme) === "dark" ? "light" : "dark"));
        return;
      }
      if (!isAdmin) return;
      const map: Record<string, string> = { PageDown: "next", ArrowLeft: "next", PageUp: "prev", ArrowRight: "prev", Space: "toggle" };
      const op = map[e.code];
      if (op) {
        e.preventDefault();
        control(op);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isAdmin, control, forcedTheme, view.event.theme]);

  const onMove = () => {
    setCursor(true);
    if (cursorTimer.current) clearTimeout(cursorTimer.current);
    cursorTimer.current = setTimeout(() => setCursor(false), 2500);
  };

  const theme = sessionTheme ?? forcedTheme ?? view.event.theme;
  const v = view;
  const q = v.question;
  const phone = v.event.phone;
  // an open audience vote takes the screen; otherwise the finals board when a challenge is on
  const voteOn = !!q && q.status === "open";
  const finalsOn = !voteOn && !!v.finals.active;
  const netClass = stale ? "net bad" : v.health.configured && v.health.error ? "net warn" : "net";
  const netText = stale ? "אין חיבור לשרת" : !v.health.configured ? "לא הוגדר חיבור לימות" : v.health.error ? `ימות: ${v.health.error}` : v.health.lastPollAt ? `מחובר · עודכן ${new Date(v.health.lastPollAt).toLocaleTimeString("he-IL")}` : "מחובר";

  return (
    <div className={`lv${cursor ? " cursor" : ""}`} data-theme={theme} dir="rtl" onMouseMove={onMove}>
      <style>{CSS}</style>
      <div className="stripe" />
      <header className="hd">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ev" src="/hackathon-2026/logo-hackathon.png" alt="האקתון AI 2026" />
          <span className="name">{v.event.name}</span>
        </div>
        {phone ? (
          <div className="phone">
            <span className="l">להצבעה התקשרו</span>
            <span className="n">{phone}</span>
          </div>
        ) : null}
      </header>

      <main className="mn">
        {voteOn && q ? (
          <QuestionScreen q={q} voted={v.voted} visible={v.resultsVisible} />
        ) : finalsOn ? (
          <FinalsScreen f={v.finals} />
        ) : q ? (
          <QuestionScreen q={q} voted={v.voted} visible={v.resultsVisible} />
        ) : (
          <section className="idle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/hackathon-2026/logo-hackathon.png" alt="" />
            <div className="big">כדי להצביע התקשרו עכשיו</div>
            {phone ? <div className="num">{phone}</div> : null}
            <div className="sub">ממתינים לשאלה הראשונה</div>
          </section>
        )}
      </main>

      <footer className="ft">
        <span className={`pill ${q?.status === "open" ? "open" : q?.status === "closed" ? "closed" : ""}`}>
          <i />
          {q?.status === "open" ? "ההצבעה פתוחה" : q?.status === "closed" ? "ההצבעה נסגרה" : "ממתינים"}
        </span>
        <span>
          הצביעו <b>{fmt(v.voted)}</b>
          {v.connected != null ? (
            <>
              {" "}
              · מחוברים <b>{fmt(v.connected)}</b>
            </>
          ) : null}
        </span>
      </footer>
      <div className={netClass}>
        <i />
        <span>{netText}</span>
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
