"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveDisplayView, LiveFinalsView, LiveQuestionView } from "@/lib/hackathon-live-shared";

const POLL_MS = 2000;

/* A show, not a web page (the owner, 26/10): a living background, every scene
   enters with motion, bars grow, numbers run, a vote lands with a "+1", the
   presenting team pulses, the winner gets confetti. One idea per screen. */
const CSS = `
.lv{position:fixed;inset:0;display:flex;flex-direction:column;overflow:hidden;font-family:var(--font-noto-hebrew),"Noto Sans Hebrew",system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  --pink:#e0418d;--pink-deep:#ce2462;--purple:#6b3d99;--indigo:#464ca0;--grad:linear-gradient(95deg,#e0418d 0%,#913f80 50%,#464ca0 100%);
  --page:#fbfafd;--surface:#ffffffcc;--line:#e7e5ef;--txt:#15132b;--txt2:#4a4868;--muted:#7a7892;--track:#ecebf5;--success:#1f9d6a;--danger:#d8345f;--blob:.55;
  background:var(--page);color:var(--txt);cursor:none}
.lv[data-theme="dark"]{--page:#0f0d26;--surface:#1c1a3acc;--line:#34325a;--txt:#fff;--txt2:#d6d4e8;--muted:#9a98b8;--track:#262448;--blob:.9}
.lv.cursor{cursor:default}
.lv>*{position:relative;z-index:1}
/* living background */
.bg{position:absolute;inset:0;overflow:hidden;z-index:0;pointer-events:none}
.bg i{position:absolute;border-radius:50%;filter:blur(90px);opacity:var(--blob);will-change:transform}
.bg i:nth-child(1){width:55vw;height:55vw;left:-15vw;top:-25vw;background:#e0418d55;animation:drift1 26s ease-in-out infinite alternate}
.bg i:nth-child(2){width:50vw;height:50vw;right:-18vw;top:10vh;background:#464ca055;animation:drift2 32s ease-in-out infinite alternate}
.bg i:nth-child(3){width:40vw;height:40vw;left:25vw;bottom:-25vw;background:#913f8044;animation:drift3 38s ease-in-out infinite alternate}
@keyframes drift1{to{transform:translate(18vw,14vh) scale(1.15)}}
@keyframes drift2{to{transform:translate(-14vw,22vh) scale(.9)}}
@keyframes drift3{to{transform:translate(-20vw,-12vh) scale(1.2)}}
.stripe{height:5px;background:linear-gradient(90deg,#ffd166,#e0418d,#913f80,#464ca0,#ffd166);background-size:200% 100%;animation:stripe 8s linear infinite;flex:none}
@keyframes stripe{to{background-position:200% 0}}
.hd{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:clamp(8px,1.4vh,18px) clamp(18px,3vw,52px)}
.brand{display:flex;align-items:center;gap:18px;min-width:0}
.brand .ev{height:clamp(40px,7vh,88px);width:auto;display:block}
.lv[data-theme="dark"] .brand .ev{background:#fff;border-radius:14px;padding:4px 10px}
.brand .name{font-size:clamp(15px,1.9vw,26px);font-weight:600;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.live{display:inline-flex;align-items:center;gap:8px;font-size:clamp(12px,1.5vh,18px);font-weight:800;color:var(--pink-deep);letter-spacing:.08em;margin-inline-start:14px}
.lv[data-theme="dark"] .live{color:#ff8ac0}
.live i{width:.7em;height:.7em;border-radius:50%;background:var(--pink);animation:beat 1.4s ease-in-out infinite}
@keyframes beat{0%,100%{transform:scale(1);box-shadow:0 0 0 0 #e0418d77}50%{transform:scale(1.25);box-shadow:0 0 0 .6em #e0418d00}}
.phone{display:flex;align-items:baseline;gap:12px;white-space:nowrap}
.phone .l{font-size:clamp(13px,1.4vw,20px);color:var(--txt2);font-weight:600}
.phone .n{font-size:clamp(24px,3.2vw,50px);font-weight:900;letter-spacing:.03em;direction:ltr;font-variant-numeric:tabular-nums;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.mn{flex:1;display:flex;flex-direction:column;padding:clamp(10px,2vh,30px) clamp(24px,5vw,96px);min-height:0}
.scene{flex:1;display:flex;flex-direction:column;min-height:0;animation:sceneIn .7s cubic-bezier(.22,1,.36,1) both}
@keyframes sceneIn{from{opacity:0;transform:translateY(18px) scale(.985)}}
.idle{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:clamp(10px,2vh,28px)}
.idle .logo{height:clamp(90px,20vh,240px);width:auto;animation:breathe 4s ease-in-out infinite}
.lv[data-theme="dark"] .idle .logo{background:#fff;border-radius:22px;padding:10px 20px}
@keyframes breathe{50%{transform:scale(1.04)}}
.idle .big{font-size:clamp(26px,4.6vw,72px);font-weight:900}
.idle .num{font-size:clamp(40px,9vw,160px);font-weight:900;letter-spacing:.04em;direction:ltr;line-height:1;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;animation:glow 2.4s ease-in-out infinite}
@keyframes glow{50%{filter:drop-shadow(0 0 22px #e0418d66)}}
.idle .sub{font-size:clamp(16px,2.2vw,30px);color:var(--txt2)}
.kick{display:inline-block;font-size:clamp(13px,1.7vh,22px);font-weight:700;color:var(--pink-deep);letter-spacing:.02em;animation:fadeUp .6s .1s both}
.lv[data-theme="dark"] .kick{color:#ff8ac0}
.ttl{font-size:clamp(28px,4.8vw,80px);font-weight:900;line-height:1.12;margin:4px 0 clamp(14px,3vh,40px);letter-spacing:-.01em;max-height:30vh;overflow:hidden;animation:titleIn .8s cubic-bezier(.22,1,.36,1) .15s both}
.ttl.long{font-size:clamp(22px,3.4vw,56px)}
@keyframes titleIn{from{opacity:0;transform:translateX(-30px)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}}
.chart{flex:1;display:flex;flex-direction:column;justify-content:center;gap:clamp(10px,2.2vh,30px);min-height:0}
.r{display:grid;grid-template-columns:auto minmax(220px,.9fr) 2fr auto;align-items:center;gap:clamp(12px,1.8vw,30px);animation:rowIn .7s cubic-bezier(.22,1,.36,1) both;transition:transform .6s}
@keyframes rowIn{from{opacity:0;transform:translateX(40px)}}
.r .k{width:clamp(34px,4.4vh,64px);height:clamp(34px,4.4vh,64px);border-radius:999px;border:2px solid var(--line);display:grid;place-items:center;font-weight:800;font-size:clamp(16px,2.4vh,32px);color:var(--txt2);font-variant-numeric:tabular-nums;background:var(--surface);transition:background .5s,color .5s}
.r.first .k{background:var(--grad);color:#fff;border-color:transparent;animation:pop .6s cubic-bezier(.34,1.56,.64,1) both}
@keyframes pop{from{transform:scale(.4)}}
.r .nm{font-size:clamp(18px,2.8vh,42px);font-weight:700;line-height:1.15;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.r .nm small{display:block;font-size:.5em;font-weight:500;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.r .nm .now{display:inline-block;font-size:.42em;font-weight:700;color:var(--pink-deep);border:1.5px solid var(--pink);border-radius:999px;padding:0 10px;margin-inline-start:10px;vertical-align:middle;animation:beat 1.6s ease-in-out infinite}
.r .tr{height:clamp(14px,2.6vh,36px);background:var(--track);border-radius:999px;overflow:hidden;position:relative}
.r .fl{position:absolute;inset:0 0 0 auto;width:0;height:100%;background:var(--grad);border-radius:999px;transition:width 1s cubic-bezier(.22,1,.36,1);transform-origin:right center;animation:barIn 1.1s cubic-bezier(.22,1,.36,1) both}
@keyframes barIn{from{transform:scaleX(0)}}
.r .fl.nz{min-width:clamp(14px,2.6vh,36px)}
.r.first .fl{box-shadow:0 0 24px #e0418d66}
.r.first .fl::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,#ffffff55 50%,transparent 70%);background-size:220% 100%;animation:shimmer 2.4s linear infinite}
@keyframes shimmer{from{background-position:120% 0}to{background-position:-120% 0}}
.r .v{font-size:clamp(20px,3.4vh,52px);font-weight:900;min-width:4.5ch;text-align:left;direction:ltr;font-variant-numeric:tabular-nums;white-space:nowrap}
.r .v small{font-size:.5em;font-weight:600;color:var(--muted);margin-inline-start:6px}
.tiles{flex:1;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:clamp(12px,2vw,32px)}
.tile{display:flex;align-items:center;gap:clamp(12px,1.6vw,24px);flex:0 1 calc((100% - (var(--cols) - 1) * clamp(12px,2vw,32px)) / var(--cols));min-width:200px;padding:clamp(14px,2.4vh,30px) clamp(16px,2vw,30px);border-radius:24px;background:var(--surface);border:1px solid var(--line);backdrop-filter:blur(8px);animation:tileIn .7s cubic-bezier(.34,1.4,.64,1) both}
@keyframes tileIn{from{opacity:0;transform:translateY(26px) scale(.92)}}
.tile .k{width:clamp(48px,7.5vh,96px);height:clamp(48px,7.5vh,96px);border-radius:22px;background:var(--grad);color:#fff;display:grid;place-items:center;font-weight:900;font-size:clamp(24px,4.4vh,56px);flex:none;box-shadow:0 10px 24px #913f8040}
.tile .nm{font-size:clamp(18px,2.8vh,40px);font-weight:700;line-height:1.15}
.tile .nm small{display:block;font-size:.55em;font-weight:500;color:var(--muted)}
.tile.now{outline:3px solid var(--pink);animation:tileIn .7s both,ring 1.8s ease-in-out infinite}
@keyframes ring{0%,100%{box-shadow:0 0 0 0 #e0418d55}50%{box-shadow:0 0 0 14px #e0418d00}}
.wait{font-size:clamp(16px,2.4vh,32px);color:var(--txt2);text-align:center;margin-top:clamp(10px,2vh,24px);display:flex;justify-content:center;align-items:center;gap:14px;flex-wrap:wrap;animation:fadeUp .6s .4s both}
.wait b{color:var(--txt);font-variant-numeric:tabular-nums;font-size:1.4em;display:inline-block;min-width:2ch;animation:pop .45s cubic-bezier(.34,1.56,.64,1)}
.plus{display:inline-block;color:var(--pink-deep);font-weight:900;animation:floatUp 1.4s ease-out both;position:relative}
@keyframes floatUp{from{opacity:0;transform:translateY(10px)}30%{opacity:1}to{opacity:0;transform:translateY(-26px)}}
.cats{display:flex;flex-wrap:wrap;gap:clamp(10px,1.4vw,24px) clamp(18px,2.6vw,44px);justify-content:center;font-size:clamp(13px,1.9vh,24px);color:var(--txt2);margin-top:clamp(8px,1.6vh,20px)}
.cats span{animation:fadeUp .6s both}
.cats b{color:var(--txt)}
.ft{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:clamp(8px,1.4vh,18px) clamp(24px,5vw,96px);border-top:1px solid var(--line);font-size:clamp(13px,1.8vh,24px);color:var(--txt2)}
.ft b{color:var(--txt);font-variant-numeric:tabular-nums}
.pill{display:inline-flex;align-items:center;gap:8px;font-weight:700}
.pill i{width:.6em;height:.6em;border-radius:50%;background:var(--muted)}
.pill.open i{background:var(--success);animation:beat 1.6s infinite} .pill.closed i{background:var(--pink)}
.net{position:absolute;bottom:6px;left:12px;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;opacity:.8}
.net i{width:8px;height:8px;border-radius:50%;background:var(--success)} .net.bad i{background:var(--danger)} .net.warn i{background:#c77800}
.toast{position:absolute;top:14px;left:50%;transform:translateX(-50%);background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:8px 16px;font-size:15px}
.confetti{position:absolute;inset:0;pointer-events:none;z-index:5}
@media (prefers-reduced-motion:reduce){.lv *{animation:none !important;transition:none !important}}
`;

const fmt = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("he-IL");

/** A number that runs to its new value instead of jumping. */
function useCountUp(value: number, ms = 700): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round((a + (b - a) * e) * 10) / 10);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

function Num({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const v = useCountUp(value);
  return <>{decimals ? v.toFixed(decimals) : fmt(Math.round(v))}</>;
}

/** The counter of a running vote: pops on change and floats a "+N". */
function VoteCounter({ voted }: { voted: number }) {
  const prev = useRef(voted);
  const [bursts, setBursts] = useState<{ id: number; n: number }[]>([]);
  useEffect(() => {
    const d = voted - prev.current;
    prev.current = voted;
    if (d > 0) {
      const id = Date.now();
      setBursts((b) => [...b.slice(-3), { id, n: d }]);
      const t = setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1500);
      return () => clearTimeout(t);
    }
  }, [voted]);
  return (
    <div className="wait">
      <span>הקישו את המספר בטלפון</span>
      <span>
        · הצביעו <b key={voted}>{fmt(voted)}</b>
        {bursts.map((b) => (
          <span key={b.id} className="plus">
            +{b.n}
          </span>
        ))}
      </span>
    </div>
  );
}

/** A short confetti burst on a canvas - the winner's moment. */
function Confetti({ fire }: { fire: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!fire) return;
    const c = ref.current;
    if (!c || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = c.offsetWidth;
    c.height = c.offsetHeight;
    const colors = ["#e0418d", "#913f80", "#464ca0", "#ffd166", "#ffffff"];
    const parts = Array.from({ length: 180 }, () => ({
      x: c.width * (0.3 + Math.random() * 0.4),
      y: c.height * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 16 - 6,
      s: 6 + Math.random() * 8,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      col: colors[Math.floor(Math.random() * colors.length)],
    }));
    const t0 = performance.now();
    let raf = 0;
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.45;
        p.vx *= 0.99;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - t / 3);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t < 3.2) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} className="confetti" />;
}

/** The audience vote on a category, or any question: numbers to press while open, bars once closed. */
function QuestionScreen({ q, voted, visible, currentId }: { q: LiveQuestionView; voted: number; visible: boolean; currentId: string | null }) {
  const title = q.category ? q.category.label : q.text;
  const max = Math.max(1, ...q.options.map((o) => o.count ?? 0));
  void currentId;
  return (
    <>
      <span className="kick">{q.category ? `הצבעת הקהל · ${q.category.challenge}` : "הצבעת הקהל"}</span>
      <h1 className={`ttl${title.length > 70 ? " long" : ""}`}>{title}</h1>
      {!visible ? (
        <>
          <div className="tiles" style={{ ["--cols" as string]: q.options.length <= 3 ? q.options.length : 3 }}>
            {q.options.map((o, i) => (
              <div key={o.n} className="tile" style={{ animationDelay: `${150 + i * 110}ms` }}>
                <div className="k">{o.n}</div>
                <div className="nm">{o.label}</div>
              </div>
            ))}
          </div>
          <VoteCounter voted={voted} />
        </>
      ) : (
        <div className="chart">
          {q.options.map((o, i) => {
            const count = o.count ?? 0;
            const first = voted > 0 && o.leading && q.options.filter((x) => x.leading).length === 1;
            return (
              <div key={o.n} className={`r${first ? " first" : ""}`} style={{ animationDelay: `${i * 120}ms` }}>
                <span className="k">{o.n}</span>
                <div className="nm">{o.label}</div>
                <div className="tr">
                  <div className={`fl${count > 0 ? " nz" : ""}`} style={{ width: `${((count / max) * 100).toFixed(1)}%`, animationDelay: `${200 + i * 120}ms` }} />
                </div>
                <div className="v">
                  {voted ? (
                    <>
                      <Num value={Math.round(o.pct ?? 0)} />%
                    </>
                  ) : (
                    "—"
                  )}
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
function FinalsScreen({ f, fire }: { f: LiveFinalsView; fire: number }) {
  const rows = f.finalists ?? [];
  const max = Math.max(1, ...rows.map((x) => x.total ?? 0));
  const ranked = !f.hidden && rows.some((x) => x.rank);
  return (
    <>
      <Confetti fire={fire} />
      <span className="kick">גמר ההאקתון</span>
      <h1 className="ttl">{f.name}</h1>
      {f.hidden ? (
        <>
          <div className="tiles" style={{ ["--cols" as string]: rows.length <= 3 ? rows.length : 3 }}>
            {rows.map((x, i) => (
              <div key={x.id} className={`tile${x.id === f.currentId ? " now" : ""}`} style={{ animationDelay: `${150 + i * 110}ms` }}>
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
            <div key={x.id} className={`r${ranked && x.rank === 1 ? " first" : ""}`} style={{ order: ranked && x.rank ? x.rank : 100 + i, animationDelay: `${i * 120}ms` }}>
              <span className="k">{ranked && x.rank ? x.rank : x.n}</span>
              <div className="nm">
                {x.name}
                {x.id === f.currentId ? <span className="now">מציגות עכשיו</span> : null}
                {x.team ? <small>{x.team}</small> : null}
              </div>
              <div className="tr">
                <div className={`fl${(x.total ?? 0) > 0 ? " nz" : ""}`} style={{ width: `${(((x.total ?? 0) / max) * 100).toFixed(1)}%`, animationDelay: `${200 + i * 120}ms` }} />
              </div>
              <div className="v">{x.total === null || x.total === undefined ? "—" : <Num value={x.total} decimals={1} />}</div>
            </div>
          ))}
        </div>
      )}
      {!f.hidden && f.categories?.some((c) => c.winner) ? (
        <div className="cats">
          {f.categories
            .filter((c) => c.winner)
            .map((c, i) => (
              <span key={c.key} style={{ animationDelay: `${500 + i * 150}ms` }}>
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
  const [fire, setFire] = useState(0);
  const celebrated = useRef<string | null>(null);
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

  const v = view;
  const q = v.question;
  const voteOn = !!q && q.status === "open";
  const finalsOn = !voteOn && !!v.finals.active;
  const boardFinal = finalsOn && !v.finals.hidden && v.finals.status === "closed" && (v.finals.finalists ?? []).some((x) => x.rank === 1);

  // the winner's moment: once per challenge, when its board is final and visible
  useEffect(() => {
    const key = boardFinal ? `${v.finals.active}:${v.finals.revealed ? "r" : "l"}` : null;
    if (key && celebrated.current !== key) {
      celebrated.current = key;
      setFire(Date.now());
    }
  }, [boardFinal, v.finals.active, v.finals.revealed]);

  const onMove = () => {
    setCursor(true);
    if (cursorTimer.current) clearTimeout(cursorTimer.current);
    cursorTimer.current = setTimeout(() => setCursor(false), 2500);
  };

  const theme = sessionTheme ?? forcedTheme ?? view.event.theme;
  const phone = v.event.phone;
  const sceneKey = voteOn ? `vote:${q.id}:${v.resultsVisible}` : finalsOn ? `board:${v.finals.active}:${v.finals.hidden}` : q ? `q:${q.id}:${q.status}` : "idle";
  const netClass = stale ? "net bad" : v.health.configured && v.health.error ? "net warn" : "net";
  const netText = stale ? "אין חיבור לשרת" : !v.health.configured ? "לא הוגדר חיבור לימות" : v.health.error ? `ימות: ${v.health.error}` : v.health.lastPollAt ? `מחובר · עודכן ${new Date(v.health.lastPollAt).toLocaleTimeString("he-IL")}` : "מחובר";

  return (
    <div className={`lv${cursor ? " cursor" : ""}`} data-theme={theme} dir="rtl" onMouseMove={onMove}>
      <style>{CSS}</style>
      <div className="bg">
        <i />
        <i />
        <i />
      </div>
      <div className="stripe" />
      <header className="hd">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="ev" src="/hackathon-2026/logo-hackathon.png" alt="האקתון AI 2026" />
          <span className="name">{v.event.name}</span>
          <span className="live">
            <i /> חי
          </span>
        </div>
        {phone ? (
          <div className="phone">
            <span className="l">להצבעה התקשרו</span>
            <span className="n">{phone}</span>
          </div>
        ) : null}
      </header>

      <main className="mn">
        <div className="scene" key={sceneKey}>
          {voteOn && q ? (
            <QuestionScreen q={q} voted={v.voted} visible={v.resultsVisible} currentId={v.finals.currentId ?? null} />
          ) : finalsOn ? (
            <FinalsScreen f={v.finals} fire={fire} />
          ) : q ? (
            <QuestionScreen q={q} voted={v.voted} visible={v.resultsVisible} currentId={null} />
          ) : (
            <section className="idle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="logo" src="/hackathon-2026/logo-hackathon.png" alt="" />
              <div className="big">כדי להצביע התקשרו עכשיו</div>
              {phone ? <div className="num">{phone}</div> : null}
              <div className="sub">ממתינים לשאלה הראשונה</div>
            </section>
          )}
        </div>
      </main>

      <footer className="ft">
        <span className={`pill ${q?.status === "open" ? "open" : q?.status === "closed" ? "closed" : ""}`}>
          <i />
          {q?.status === "open" ? "ההצבעה פתוחה" : q?.status === "closed" ? "ההצבעה נסגרה" : "ממתינים"}
        </span>
        <span>
          הצביעו <b><Num value={v.voted} /></b>
          {v.connected != null ? (
            <>
              {" "}
              · מחוברים <b><Num value={v.connected} /></b>
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
