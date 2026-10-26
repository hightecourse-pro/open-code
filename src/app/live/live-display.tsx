"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveDisplayView, LiveFinalsView, LiveQuestionView } from "@/lib/hackathon-live-shared";

const POLL_MS = 2000;

/* Slides, not pages (the owner, 26/10): a title slide while nothing runs, the
   ballot slide once after the three presentations - walking the audience
   through the criteria one by one with a clock - and a results slide when the
   organiser closes the challenge. No header, no footer, no status bar. */
const CSS = `
.lv{position:fixed;inset:0;overflow:hidden;font-family:var(--font-noto-hebrew),"Noto Sans Hebrew",system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  --pink:#e0418d;--pink-deep:#ce2462;--purple:#6b3d99;--indigo:#464ca0;--grad:linear-gradient(95deg,#e0418d 0%,#913f80 50%,#464ca0 100%);
  --page:#fbfafd;--surface:#ffffffd9;--line:#e7e5ef;--txt:#15132b;--txt2:#4a4868;--muted:#7a7892;--track:#ecebf5;--success:#1f9d6a;--danger:#d8345f;--blob:.6;
  background:var(--page);color:var(--txt);cursor:none}
.lv[data-theme="dark"]{--page:#0d0b24;--surface:#1b1938d9;--line:#34325a;--txt:#fff;--txt2:#d6d4e8;--muted:#9a98b8;--track:#262448;--blob:1}
.lv.cursor{cursor:default}
.bg{position:absolute;inset:0;overflow:hidden;z-index:0;pointer-events:none}
.bg i{position:absolute;border-radius:50%;filter:blur(100px);opacity:var(--blob);will-change:transform}
.bg i:nth-child(1){width:60vw;height:60vw;left:-18vw;top:-28vw;background:#e0418d55;animation:drift1 26s ease-in-out infinite alternate}
.bg i:nth-child(2){width:55vw;height:55vw;right:-20vw;top:8vh;background:#464ca055;animation:drift2 32s ease-in-out infinite alternate}
.bg i:nth-child(3){width:45vw;height:45vw;left:25vw;bottom:-28vw;background:#913f8044;animation:drift3 38s ease-in-out infinite alternate}
@keyframes drift1{to{transform:translate(18vw,14vh) scale(1.15)}}
@keyframes drift2{to{transform:translate(-14vw,22vh) scale(.9)}}
@keyframes drift3{to{transform:translate(-20vw,-12vh) scale(1.2)}}
.corner{position:absolute;top:clamp(14px,2.4vh,28px);right:clamp(18px,2.4vw,40px);z-index:2;display:flex;align-items:center;gap:14px}
.corner img{height:clamp(34px,6vh,70px);width:auto;display:block}
.lv[data-theme="dark"] .corner img{background:#fff;border-radius:12px;padding:3px 8px}
.corner .ev{font-size:clamp(13px,1.7vh,20px);font-weight:600;color:var(--txt2)}
.slide{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(40px,7vh,90px) clamp(40px,6vw,120px);animation:slideIn .8s cubic-bezier(.22,1,.36,1) both}
@keyframes slideIn{from{opacity:0;transform:translateY(24px) scale(.98)}}
.kick{font-size:clamp(14px,2vh,26px);font-weight:700;color:var(--pink-deep);letter-spacing:.06em;animation:fadeUp .6s .1s both}
.lv[data-theme="dark"] .kick{color:#ff8ac0}
.h{font-size:clamp(34px,5.6vw,92px);font-weight:900;line-height:1.08;letter-spacing:-.01em;margin:6px 0 0;text-align:center;animation:titleIn .8s cubic-bezier(.22,1,.36,1) .12s both}
@keyframes titleIn{from{opacity:0;transform:translateY(16px)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}}
/* title slide */
.title .logo{height:clamp(140px,30vh,360px);width:auto;animation:breathe 4s ease-in-out infinite}
.lv[data-theme="dark"] .title .logo{background:#fff;border-radius:28px;padding:16px 28px}
@keyframes breathe{50%{transform:scale(1.04)}}
.title .ev{margin-top:clamp(16px,3vh,36px);font-size:clamp(22px,3vw,48px);font-weight:800;color:var(--txt2)}
/* ballot */
.ballot{justify-content:space-between;align-items:stretch}
.ballot .top{text-align:center}
.projects{display:flex;justify-content:center;gap:clamp(14px,2vw,34px);margin:clamp(12px,2.4vh,30px) 0}
.pr{display:flex;align-items:center;gap:clamp(12px,1.4vw,22px);flex:1 1 0;max-width:34%;padding:clamp(12px,2vh,26px) clamp(16px,1.8vw,30px);border-radius:26px;background:var(--surface);border:1px solid var(--line);backdrop-filter:blur(8px);animation:tileIn .7s cubic-bezier(.34,1.4,.64,1) both}
@keyframes tileIn{from{opacity:0;transform:translateY(26px) scale(.92)}}
.pr .k{width:clamp(52px,8.4vh,108px);height:clamp(52px,8.4vh,108px);border-radius:24px;background:var(--grad);color:#fff;display:grid;place-items:center;font-weight:900;font-size:clamp(28px,5vh,64px);flex:none;box-shadow:0 10px 24px #913f8040}
.pr .nm{font-size:clamp(17px,2.6vh,36px);font-weight:800;line-height:1.15}
.steps{display:flex;flex-direction:column;gap:clamp(6px,1.2vh,14px);flex:1;justify-content:center;min-height:0}
.st{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:clamp(12px,1.6vw,26px);padding:clamp(6px,1.1vh,14px) clamp(14px,1.6vw,26px);border-radius:22px;transition:all .5s;animation:fadeUp .6s both}
.st .c{width:clamp(30px,4.2vh,54px);height:clamp(30px,4.2vh,54px);border-radius:999px;border:2px solid var(--line);display:grid;place-items:center;font-weight:800;font-size:clamp(14px,2.2vh,28px);color:var(--txt2);background:var(--surface)}
.st .l{font-size:clamp(18px,2.8vh,38px);font-weight:700;color:var(--txt2)}
.st.next{opacity:.45}
.st.done .c{background:var(--success);border-color:transparent;color:#fff}
.st.done .l{text-decoration:line-through;text-decoration-color:var(--muted);text-decoration-thickness:2px}
.st.open{background:var(--surface);border:1px solid var(--line);box-shadow:0 14px 40px #2e2e6e22;transform:scale(1.02)}
.st.open .c{background:var(--grad);border-color:transparent;color:#fff}
.st.open .l{font-size:clamp(26px,4.4vh,60px);font-weight:900;color:var(--txt)}
.st .hint{font-size:clamp(14px,2vh,26px);color:var(--txt2);font-weight:600;white-space:nowrap}
.st.open .hint{color:var(--pink-deep)}
.lv[data-theme="dark"] .st.open .hint{color:#ff8ac0}
.ring{position:relative;width:clamp(56px,9vh,110px);height:clamp(56px,9vh,110px);display:grid;place-items:center}
.ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.ring circle{fill:none;stroke-width:6}
.ring .bgc{stroke:var(--track)}
.ring .fgc{stroke:url(#lvgrad);stroke-linecap:round;transition:stroke-dashoffset .9s linear}
.ring b{font-size:clamp(18px,3vh,38px);font-weight:900;font-variant-numeric:tabular-nums}
.ring.low b{color:var(--danger);animation:beat 1s infinite}
.cta{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;animation:fadeUp .6s .3s both}
.cta .ph{display:flex;align-items:baseline;gap:12px}
.cta .ph .l{font-size:clamp(14px,1.8vh,24px);color:var(--txt2);font-weight:600}
.cta .ph .n{font-size:clamp(28px,4vw,64px);font-weight:900;letter-spacing:.03em;direction:ltr;font-variant-numeric:tabular-nums;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.cta .cnt{font-size:clamp(16px,2.4vh,32px);color:var(--txt2);font-weight:600;display:flex;align-items:center;gap:10px}
.cta .cnt b{color:var(--txt);font-variant-numeric:tabular-nums;font-size:1.5em;display:inline-block;min-width:2ch;animation:pop .45s cubic-bezier(.34,1.56,.64,1)}
@keyframes pop{from{transform:scale(.4)}}
.plus{display:inline-block;color:var(--pink-deep);font-weight:900;animation:floatUp 1.4s ease-out both}
@keyframes floatUp{from{opacity:0;transform:translateY(10px)}30%{opacity:1}to{opacity:0;transform:translateY(-26px)}}
.done-all{font-size:clamp(26px,4.4vh,60px);font-weight:900;text-align:center;animation:fadeUp .6s both}
/* results */
.winner{text-align:center;margin:clamp(8px,1.6vh,20px) 0 clamp(14px,2.6vh,34px);animation:winIn 1s cubic-bezier(.34,1.3,.64,1) .3s both}
@keyframes winIn{from{opacity:0;transform:scale(.6)}}
.winner .l{font-size:clamp(16px,2.4vh,30px);color:var(--pink-deep);font-weight:800;letter-spacing:.08em}
.lv[data-theme="dark"] .winner .l{color:#ff8ac0}
.winner .n{font-size:clamp(36px,6vw,104px);font-weight:900;line-height:1.05;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;animation:glow 2.4s ease-in-out infinite}
@keyframes glow{50%{filter:drop-shadow(0 0 22px #e0418d66)}}
.chart{display:flex;flex-direction:column;gap:clamp(10px,2vh,28px);width:100%;max-width:1500px}
.r{display:grid;grid-template-columns:auto minmax(220px,.9fr) 2fr auto;align-items:center;gap:clamp(12px,1.8vw,30px);animation:rowIn .7s cubic-bezier(.22,1,.36,1) both}
@keyframes rowIn{from{opacity:0;transform:translateX(40px)}}
.r .k{width:clamp(34px,4.4vh,64px);height:clamp(34px,4.4vh,64px);border-radius:999px;border:2px solid var(--line);display:grid;place-items:center;font-weight:800;font-size:clamp(16px,2.4vh,32px);color:var(--txt2);background:var(--surface)}
.r.first .k{background:var(--grad);color:#fff;border-color:transparent;animation:pop .6s cubic-bezier(.34,1.56,.64,1) both}
.r .nm{font-size:clamp(18px,2.8vh,42px);font-weight:700;line-height:1.15}
.r .tr{height:clamp(14px,2.6vh,36px);background:var(--track);border-radius:999px;overflow:hidden;position:relative}
.r .fl{position:absolute;inset:0 0 0 auto;width:0;height:100%;background:var(--grad);border-radius:999px;transition:width 1s cubic-bezier(.22,1,.36,1);transform-origin:right center;animation:barIn 1.1s cubic-bezier(.22,1,.36,1) both}
@keyframes barIn{from{transform:scaleX(0)}}
.r .fl.nz{min-width:clamp(14px,2.6vh,36px)}
.r.first .fl{box-shadow:0 0 24px #e0418d66}
.r.first .fl::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,#ffffff55 50%,transparent 70%);background-size:220% 100%;animation:shimmer 2.4s linear infinite}
@keyframes shimmer{from{background-position:120% 0}to{background-position:-120% 0}}
.r .v{font-size:clamp(20px,3.4vh,52px);font-weight:900;min-width:4.5ch;text-align:left;direction:ltr;font-variant-numeric:tabular-nums;white-space:nowrap}
.r .v small{font-size:.5em;font-weight:600;color:var(--muted);margin-inline-start:6px}
.cats{display:flex;flex-wrap:wrap;gap:clamp(10px,1.4vw,24px) clamp(18px,2.6vw,44px);justify-content:center;font-size:clamp(14px,2vh,26px);color:var(--txt2);margin-top:clamp(14px,2.6vh,34px)}
.cats span{animation:fadeUp .6s both}
.cats b{color:var(--txt)}
.soon{font-size:clamp(20px,3vh,40px);color:var(--txt2);font-weight:700;margin-top:clamp(14px,2.6vh,34px);animation:fadeUp .6s .4s both}
@keyframes beat{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
.net{position:absolute;bottom:6px;left:12px;z-index:2;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;opacity:.7}
.net i{width:8px;height:8px;border-radius:50%;background:var(--success)} .net.bad i{background:var(--danger)} .net.warn i{background:#c77800}
.toast{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:3;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:8px 16px;font-size:15px}
.confetti{position:absolute;inset:0;pointer-events:none;z-index:4}
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

/** The vote counter: pops on change and floats a "+N". */
function Counter({ voted }: { voted: number }) {
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
    <span className="cnt">
      הצביעו <b key={voted}>{fmt(voted)}</b>
      {bursts.map((b) => (
        <span key={b.id} className="plus">
          +{b.n}
        </span>
      ))}
    </span>
  );
}

/** The countdown of the open category. */
function Ring({ openedAt, seconds }: { openedAt: string; seconds: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const end = Date.parse(openedAt) + seconds * 1000;
    const tick = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [openedAt, seconds]);
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className={`ring${left <= 10 ? " low" : ""}`}>
      <svg viewBox="0 0 100 100">
        <defs>
          <linearGradient id="lvgrad" x1="0" x2="1">
            <stop offset="0" stopColor="#e0418d" />
            <stop offset="1" stopColor="#464ca0" />
          </linearGradient>
        </defs>
        <circle className="bgc" cx="50" cy="50" r={r} />
        <circle className="fgc" cx="50" cy="50" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - left / Math.max(1, seconds))} />
      </svg>
      <b>{left}</b>
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
    const parts = Array.from({ length: 220 }, () => ({
      x: c.width * (0.3 + Math.random() * 0.4),
      y: c.height * 0.4,
      vx: (Math.random() - 0.5) * 18,
      vy: -Math.random() * 17 - 6,
      s: 6 + Math.random() * 9,
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
        ctx.globalAlpha = Math.max(0, 1 - t / 3.4);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t < 3.6) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} className="confetti" />;
}

/** The ballot: the three contestants, the criteria one after another, the phone to call. */
function BallotSlide({ f, voted, phone, voteSeconds }: { f: LiveFinalsView; voted: number; phone: string; voteSeconds: number }) {
  const rows = f.finalists ?? [];
  const steps = f.steps ?? [];
  const open = steps.find((s) => s.status === "open");
  const allDone = steps.length > 0 && steps.every((s) => s.status === "done");
  return (
    <section className="slide ballot">
      <div className="top">
        <span className="kick">הצבעת הקהל</span>
        <h1 className="h">{f.name}</h1>
      </div>
      <div className="projects">
        {rows.map((x, i) => (
          <div key={x.id} className="pr tile" style={{ animationDelay: `${150 + i * 120}ms` }}>
            <span className="k">{x.n}</span>
            <span className="nm">{x.name}</span>
          </div>
        ))}
      </div>
      {allDone ? (
        <div className="done-all">ההצבעה הסתיימה - תודה! התוצאות בעוד רגע</div>
      ) : (
        <div className="steps">
          {steps.map((s, i) => (
            <div key={s.key} className={`st ${s.status}`} style={{ animationDelay: `${300 + i * 100}ms` }}>
              <span className="c">{s.status === "done" ? "✓" : i + 1}</span>
              <span className="l">{s.label}</span>
              {s.status === "open" ? (
                <span style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <span className="hint">הקישו {rows.map((x) => x.n).join(", ").replace(/, (\d)$/, " או $1")} בטלפון</span>
                  {voteSeconds > 0 && s.openedAt ? <Ring openedAt={s.openedAt} seconds={voteSeconds} /> : null}
                </span>
              ) : (
                <span className="hint">{s.status === "done" ? "נספר" : ""}</span>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="cta">
        {phone ? (
          <span className="ph">
            <span className="l">התקשרו</span>
            <span className="n">{phone}</span>
          </span>
        ) : (
          <span />
        )}
        {open ? <Counter voted={voted} /> : <span />}
      </div>
    </section>
  );
}

/** The results: the winner, the three bars, the audience's picks. */
function ResultsSlide({ f, fire }: { f: LiveFinalsView; fire: number }) {
  const rows = f.finalists ?? [];
  const max = Math.max(1, ...rows.map((x) => x.total ?? 0));
  const winner = rows.find((x) => x.rank === 1);
  if (f.hidden) {
    return (
      <section className="slide">
        <span className="kick">תודה שהצבעתן</span>
        <h1 className="h">{f.name}</h1>
        <div className="projects" style={{ marginTop: "clamp(24px,4vh,48px)" }}>
          {rows.map((x, i) => (
            <div key={x.id} className="pr tile" style={{ animationDelay: `${150 + i * 120}ms` }}>
              <span className="k">{x.n}</span>
              <span className="nm">{x.name}</span>
            </div>
          ))}
        </div>
        <div className="soon">התוצאות ייחשפו בעוד רגע</div>
      </section>
    );
  }
  return (
    <section className="slide">
      <Confetti fire={fire} />
      <span className="kick">התוצאות · {f.name}</span>
      {winner ? (
        <div className="winner">
          <div className="l">המנצחת</div>
          <div className="n">{winner.name}</div>
        </div>
      ) : (
        <h1 className="h">{f.name}</h1>
      )}
      <div className="chart">
        {rows.map((x, i) => (
          <div key={x.id} className={`r${x.rank === 1 ? " first" : ""}`} style={{ order: x.rank ?? 100 + i, animationDelay: `${400 + i * 150}ms` }}>
            <span className="k">{x.rank ?? x.n}</span>
            <div className="nm">{x.name}</div>
            <div className="tr">
              <div className={`fl${(x.total ?? 0) > 0 ? " nz" : ""}`} style={{ width: `${(((x.total ?? 0) / max) * 100).toFixed(1)}%`, animationDelay: `${600 + i * 150}ms` }} />
            </div>
            <div className="v">{x.total === null || x.total === undefined ? "—" : <Num value={x.total} decimals={1} />}</div>
          </div>
        ))}
      </div>
      {f.categories?.some((c) => c.winner) ? (
        <div className="cats">
          {f.categories
            .filter((c) => c.winner)
            .map((c, i) => (
              <span key={c.key} style={{ animationDelay: `${900 + i * 150}ms` }}>
                {c.label}: <b>{c.winner}</b>
              </span>
            ))}
        </div>
      ) : null}
    </section>
  );
}

/** A question outside the finals (an ice-breaker, a poll): numbers while open, bars once closed. */
function QuestionSlide({ q, voted, visible, phone }: { q: LiveQuestionView; voted: number; visible: boolean; phone: string }) {
  const max = Math.max(1, ...q.options.map((o) => o.count ?? 0));
  return (
    <section className="slide ballot">
      <div className="top">
        <span className="kick">הצבעת הקהל</span>
        <h1 className="h">{q.text}</h1>
      </div>
      {!visible ? (
        <div className="projects" style={{ flexWrap: "wrap" }}>
          {q.options.map((o, i) => (
            <div key={o.n} className="pr tile" style={{ animationDelay: `${150 + i * 110}ms`, maxWidth: q.options.length <= 3 ? "34%" : "30%" }}>
              <span className="k">{o.n}</span>
              <span className="nm">{o.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="chart" style={{ alignSelf: "center" }}>
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
      <div className="cta">
        {phone && !visible ? (
          <span className="ph">
            <span className="l">התקשרו</span>
            <span className="n">{phone}</span>
          </span>
        ) : (
          <span />
        )}
        {!visible ? <Counter voted={voted} /> : <span />}
      </div>
    </section>
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
  const f = v.finals;
  // which slide: the finals' ballot or results when a challenge is on; a plain question when one runs; else the title
  const finalsOn = !!f.active;
  const ballot = finalsOn && f.status === "judging";
  const results = finalsOn && f.status !== "judging";
  const plainQ = !finalsOn && !!q && !q.category;
  const boardFinal = results && !f.hidden && (f.finalists ?? []).some((x) => x.rank === 1);

  useEffect(() => {
    const key = boardFinal ? `${f.active}:${f.revealed ? "r" : "l"}` : null;
    if (key && celebrated.current !== key) {
      celebrated.current = key;
      setFire(Date.now());
    }
  }, [boardFinal, f.active, f.revealed]);

  const onMove = () => {
    setCursor(true);
    if (cursorTimer.current) clearTimeout(cursorTimer.current);
    cursorTimer.current = setTimeout(() => setCursor(false), 2500);
  };

  const theme = sessionTheme ?? forcedTheme ?? v.event.theme;
  const phone = v.event.phone;
  const sceneKey = ballot ? `ballot:${f.active}:${(f.steps ?? []).map((s) => s.status[0]).join("")}` : results ? `results:${f.active}:${f.hidden}` : plainQ ? `q:${q!.id}:${v.resultsVisible}` : "title";
  const netClass = stale ? "net bad" : v.health.configured && v.health.error ? "net warn" : "net";
  const netText = stale ? "אין חיבור לשרת" : !v.health.configured ? "לא הוגדר חיבור לימות" : v.health.error ? `ימות: ${v.health.error}` : v.health.lastPollAt ? `מחובר · ${new Date(v.health.lastPollAt).toLocaleTimeString("he-IL")}` : "מחובר";

  return (
    <div className={`lv${cursor ? " cursor" : ""}`} data-theme={theme} dir="rtl" onMouseMove={onMove}>
      <style>{CSS}</style>
      <div className="bg">
        <i />
        <i />
        <i />
      </div>
      {sceneKey !== "title" ? (
        <div className="corner">
          <span className="ev">{v.event.name}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hackathon-2026/logo-hackathon.png" alt="האקתון AI 2026" />
        </div>
      ) : null}
      <div key={sceneKey} style={{ position: "absolute", inset: 0 }}>
        {ballot ? (
          <BallotSlide f={f} voted={v.voted} phone={phone} voteSeconds={v.event.voteSeconds} />
        ) : results ? (
          <ResultsSlide f={f} fire={fire} />
        ) : plainQ ? (
          <QuestionSlide q={q!} voted={v.voted} visible={v.resultsVisible} phone={phone} />
        ) : (
          <section className="slide title">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/hackathon-2026/logo-hackathon.png" alt="האקתון AI 2026" />
            <div className="ev">{v.event.name}</div>
          </section>
        )}
      </div>
      <div className={netClass}>
        <i />
        <span>{netText}</span>
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
