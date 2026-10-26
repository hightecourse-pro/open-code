"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LiveDisplayView, LiveFinalistRow, LiveFinalsView, LiveQuestionView, LiveStep } from "@/lib/hackathon-live-shared";

const POLL_MS = 2000;
const STAGE_W = 1920;
const STAGE_H = 1080;

/* The approved design of the LED screen (phone-system/hackathon-voting, 26/10):
   a 1920×1080 stage scaled to the screen, the brand tokens only, Heebo for text
   and numbers, Karantina for the big titles, white logos on #15123A. Three
   screens - the vote per category (bars rising with the audience's share, in
   percentages only - never a vote count), the judges' scores before the reveal,
   and the winner on a podium - plus a clean opening screen while nothing runs.
   The operator's buttons live in the control panel, never on this screen. */
const CSS = `
.lv{position:fixed;inset:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--ink);cursor:none;-webkit-font-smoothing:antialiased;
  font-family:var(--font-heebo),Heebo,"Noto Sans Hebrew",sans-serif;
  --bg:#15123A;--panel:#221D55;--panel-border:#3A3480;--ink:#FFFFFF;--muted:#C9C6F2;--p1:#F0306E;--p2:#C35BC0;--p3:#7B83F0;--line:#FFFFFF;--chip-idle:#4A4490;--dot:#FF4D7E;--dot-off:#8E8AC0;--live-bg:rgba(0,0,0,.2)}
.lv[data-theme="light"]{--bg:#FFFFFF;--panel:#4A4EA2;--panel-border:#4A4EA2;--ink:#1F1A4A;--muted:#5B5687;--p1:#D81B5A;--p2:#8E3F86;--p3:#4A4EA2;--line:#1F1A4A;--chip-idle:#CFCBE6;--live-bg:rgba(0,0,0,.18)}
.lv.cursor{cursor:default}
.kr{font-family:var(--font-karantina),Karantina,var(--font-heebo),Heebo,sans-serif}
.stage{width:1920px;height:1080px;position:relative;overflow:hidden;flex:none;background:var(--bg);display:flex;flex-direction:column;padding:40px 72px 32px;transform-origin:center}
.bracket{position:absolute;top:330px;pointer-events:none}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;padding:40px 72px 32px;animation:sceneIn .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes sceneIn{from{opacity:0}}
.hd{display:flex;align-items:center;justify-content:space-between;gap:40px;height:150px;flex-shrink:0}
.hd img{display:block;width:auto}
.tw{flex:1;display:flex;flex-direction:column;align-items:center;gap:12px;min-width:0}
.kicker{font-weight:700;font-size:30px;line-height:1;color:var(--muted);white-space:nowrap}
.ttl{font-weight:700;font-size:124px;line-height:.9;white-space:nowrap;text-align:center}
.ttl.long{font-size:100px}
.ttl.wrap{white-space:normal;font-size:84px;line-height:.95;max-width:1200px}
.rule{height:6px;border-radius:3px;background:linear-gradient(90deg,var(--p3),var(--p2),var(--p1));margin-top:8px;flex-shrink:0}
.screen{flex:1;display:flex;flex-direction:column;min-height:0}
.steps{display:flex;justify-content:center;gap:14px;margin-top:22px}
.chip{font-weight:700;font-size:24px;line-height:1;padding:11px 24px;border-radius:999px;border:2px solid var(--chip-idle);color:var(--muted);transition:background .4s,border-color .4s,color .4s}
.chip.done{border-color:var(--p3);color:var(--ink)}
.chip.on{background:var(--p1);border-color:var(--p1);color:#fff}
.chart{flex:1;display:flex;justify-content:center;gap:100px;padding:0 60px;min-height:0}
.col{width:400px;display:flex;flex-direction:column;align-items:center;animation:colIn .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes colIn{from{opacity:0;transform:translateY(20px)}}
.col-top{height:530px;width:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:14px}
.lead{font-weight:800;font-size:22px;line-height:1;color:var(--bg);background:var(--ink);padding:9px 18px;border-radius:999px;visibility:hidden}
.lead.show{visibility:visible;animation:leadIn .4s cubic-bezier(.2,.8,.2,1) both}
@keyframes leadIn{from{opacity:0;transform:translateY(8px)}}
.pct{font-weight:900;font-size:100px;line-height:1;font-variant-numeric:tabular-nums;direction:ltr}
.pct small{font-size:48px;font-weight:800}
.pct.hide{visibility:hidden}
.bar{width:270px;min-height:6px;height:0;border-radius:18px 18px 4px 4px;transition:height .8s cubic-bezier(.2,.8,.2,1),box-shadow .3s}
.base{width:360px;height:5px;background:var(--line);border-radius:3px}
.label{display:flex;align-items:center;gap:18px;margin-top:22px;max-width:100%}
.key{width:70px;height:70px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:44px;line-height:1;flex:none}
.name{font-weight:800;font-size:36px;line-height:1.08}
.name.sm{font-size:30px}
.hint{font-weight:700;font-size:24px;line-height:1;color:var(--muted);margin-top:8px}
.phone{display:flex;align-items:center;justify-content:space-between;gap:32px;margin-top:26px;padding:18px 30px;border-radius:22px;background:var(--panel);border:2px solid var(--panel-border);color:#fff;flex-shrink:0}
.phone-l{display:flex;align-items:center;gap:22px;min-width:0}
.phone-ic{width:66px;height:66px;border-radius:18px;background:var(--p1);display:flex;align-items:center;justify-content:center;flex:none}
.phone-num{font-weight:900;font-size:50px;line-height:1;direction:ltr;letter-spacing:.03em;font-variant-numeric:tabular-nums}
.phone-txt{font-weight:700;font-size:27px;line-height:1.3;max-width:560px;margin-inline-start:18px}
.live{display:flex;align-items:center;gap:14px;padding:12px 24px;border-radius:999px;background:var(--live-bg);flex:none;font-weight:800;font-size:28px;line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums}
.dot{width:18px;height:18px;border-radius:50%;background:var(--dot);animation:pulse 1.4s infinite;flex:none}
.dot.off{background:var(--dot-off);animation:none}
@keyframes pulse{50%{opacity:.3}}
.judges{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:44px}
.jrow{display:flex;gap:48px;justify-content:center}
.jcard{width:430px;padding:40px 36px;border-radius:28px;background:var(--panel);border:3px solid;display:flex;flex-direction:column;align-items:center;gap:22px;color:#fff;animation:colIn .7s cubic-bezier(.2,.8,.2,1) both}
.jcard .name{text-align:center}
.jscore{font-weight:900;font-size:156px;line-height:1;font-variant-numeric:tabular-nums;direction:ltr}
.jof{font-weight:700;font-size:40px;opacity:.8}
.foot{font-weight:700;font-size:27px;line-height:1.3;color:var(--muted);text-align:center}
.results{flex:1;display:flex;flex-direction:column;align-items:center;min-height:0}
.winner{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:14px;animation:winIn 1s cubic-bezier(.2,.8,.2,1) both}
.winner-name{font-weight:700;font-size:156px;line-height:.95;white-space:nowrap}
.winner-name.long{font-size:120px}
.winner-sub{font-weight:700;font-size:32px;color:var(--muted)}
.winner-sub b{color:var(--ink)}
@keyframes winIn{from{opacity:0;transform:translateY(40px) scale(.96)}}
.podium{flex:1;display:flex;align-items:flex-end;justify-content:center;gap:36px;width:100%;min-height:0}
.pod{width:420px;display:flex;flex-direction:column}
.pod-head{display:flex;flex-direction:column;align-items:center;gap:10px;padding-bottom:16px;animation:colIn .7s cubic-bezier(.2,.8,.2,1) both}
.pod-stats{display:flex;gap:20px;font-weight:700;font-size:24px;color:var(--muted);white-space:nowrap}
.pod-stats b{color:var(--ink)}
.pod-block{border-radius:20px 20px 0 0;display:flex;flex-direction:column;align-items:center;padding-top:22px;gap:6px;color:#fff;transform-origin:bottom;animation:rise .9s cubic-bezier(.2,.8,.2,1) both}
.pod-rank{font-weight:900;font-size:80px;line-height:1}
.pod-total{font-weight:900;font-size:32px;font-variant-numeric:tabular-nums}
@keyframes rise{from{transform:scaleY(0)}}
.baseline{width:100%;height:5px;background:var(--line);flex-shrink:0}
.opening{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px}
.opening img{display:block;width:auto}
.opening .ev{font-weight:700;font-size:120px;line-height:.95;text-align:center;animation:colIn .9s .2s both}
.opening .rule{width:520px;margin:0}
.net{position:absolute;bottom:8px;left:16px;font-size:14px;color:var(--muted);opacity:.6;display:flex;align-items:center;gap:6px}
.net i{width:8px;height:8px;border-radius:50%;background:var(--p1)}
.toast{position:absolute;top:14px;left:50%;transform:translateX(-50%);background:var(--panel);color:#fff;border-radius:14px;padding:8px 16px;font-size:18px}
.confetti{position:absolute;inset:0;pointer-events:none;z-index:4}
@media (prefers-reduced-motion:reduce){.lv *{animation:none !important;transition:none !important}}
`;

const COLORS = ["var(--p1)", "var(--p2)", "var(--p3)"];
const colorOf = (i: number) => COLORS[i % COLORS.length];
const fmt1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);

/** "דבורה מייזליק + שרה אוחנה" - one line per submitter. */
function Name({ name, className = "name" }: { name: string; className?: string }) {
  const lines = name.split(/\s*\+\s*/).filter(Boolean);
  const small = lines.some((l) => l.length > 15);
  return (
    <div className={`${className}${small ? " sm" : ""}`}>
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

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

function Pct({ value, hidden }: { value: number; hidden?: boolean }) {
  const v = useCountUp(value);
  return (
    <div className={`pct${hidden ? " hide" : ""}`}>
      {Math.round(v)}
      <small>%</small>
    </div>
  );
}

/** Seconds left on the open category's clock. */
function useLeft(openedAt: string | null, seconds: number): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!openedAt || !seconds) return;
    const end = Date.parse(openedAt) + seconds * 1000;
    const tick = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    const t = setInterval(tick, 250);
    tick();
    return () => clearInterval(t);
  }, [openedAt, seconds]);
  return openedAt && seconds ? left : null;
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
    c.width = STAGE_W;
    c.height = STAGE_H;
    const colors = ["#F0306E", "#C35BC0", "#7B83F0", "#ffffff"];
    const parts = Array.from({ length: 240 }, () => ({
      x: c.width * (0.3 + Math.random() * 0.4),
      y: c.height * 0.35,
      vx: (Math.random() - 0.5) * 20,
      vy: -Math.random() * 18 - 6,
      s: 7 + Math.random() * 10,
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
        ctx.globalAlpha = Math.max(0, 1 - t / 3.8);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t < 4) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} className="confetti" />;
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

/** The frame every screen shares: the two logos, a kicker and a big title, the gradient rule. */
function Frame({ kicker, title, titleClass = "", light, children }: { kicker: string; title: string; titleClass?: string; light: boolean; children: React.ReactNode }) {
  return (
    <div className="scene">
      <div className="hd">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={light ? "/live/hackathon-color.png" : "/live/hackathon-white.png"} alt="האקתון AI 2026" style={{ height: 146 }} />
        <div className="tw">
          <div className="kicker">{kicker}</div>
          <div className={`ttl kr ${titleClass}`}>{title}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={light ? "/live/opencode-color.png" : "/live/opencode-white.png"} alt="קוד פתוח" style={{ height: 118 }} />
      </div>
      <div className="rule" />
      {children}
    </div>
  );
}

/** "1, 2 או 3" */
const keysText = (ns: number[]) => ns.join(", ").replace(/, (\d)$/, " או $1");

/** The phone panel under the chart: the number, what to press, the live dot. */
function PhonePanel({ phone, keys, state, left }: { phone: string; keys: number[]; state: "open" | "paused" | "closed" | "done"; left: number | null }) {
  const label = state === "open" ? "ההצבעה פתוחה" : state === "done" ? "ההצבעה הסתיימה" : state === "closed" ? "הקטגוריה נסגרה" : "ההצבעה מושהית";
  return (
    <div className="phone">
      <div className="phone-l">
        <div className="phone-ic">
          <PhoneIcon />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 24, lineHeight: 1, opacity: 0.85 }}>חייגו מכל טלפון</div>
          <div className="phone-num">{phone || "[מספר הקו]"}</div>
        </div>
        <div className="phone-txt">{state === "open" ? `והקישו את מספר הפרויקט - ${keysText(keys)}. קול אחד לכל טלפון בכל קטגוריה.` : state === "done" ? "תודה שהצבעתן! התוצאות בעוד רגע." : "ההצבעה תיפתח בעוד רגע."}</div>
      </div>
      <div className="live">
        <div className={`dot${state === "open" ? "" : " off"}`} />
        <div>
          {label}
          {state === "open" && left !== null ? ` · ${left} שנ׳` : ""}
        </div>
      </div>
    </div>
  );
}

/** The columns: one per contestant, the bar at her share of this category's votes. */
function Columns({ items, hidePct, flash }: { items: { id: string; n: number; name: string; pct: number; leading: boolean }[]; hidePct: boolean; flash: Set<string> }) {
  const max = Math.max(0, ...items.map((x) => x.pct));
  const scale = Math.max(50, max + 12);
  const unique = items.filter((x) => x.pct === max).length === 1;
  const n = items.length;
  const colW = n > 3 ? Math.floor(Math.min(400, (1776 - 40 * (n - 1)) / n)) : 400;
  return (
    <div className="chart" style={n > 3 ? { gap: 40, padding: 0 } : undefined}>
      {items.map((x, i) => (
        <div key={x.id} className="col" style={{ width: colW, animationDelay: `${i * 90}ms` }}>
          <div className="col-top">
            <div className={`lead${!hidePct && max > 0 && unique && x.pct === max ? " show" : ""}`}>מובילה כרגע</div>
            <Pct value={hidePct ? 0 : x.pct} hidden={hidePct} />
            <div className="bar" style={{ background: colorOf(i), width: Math.min(270, colW - 40), height: hidePct ? 0 : Math.round((x.pct / scale) * 380), boxShadow: flash.has(x.id) ? `0 0 70px ${colorOf(i)}` : "none" }} />
          </div>
          <div className="base" style={{ width: Math.min(360, colW) }} />
          <div className="label">
            <div className="key" style={{ background: colorOf(i) }}>{x.n}</div>
            <div>
              <Name name={x.name} />
              <div className="hint">להצבעה הקישו {x.n}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** A column that just gained a vote glows for a moment. */
function useFlash(items: { id: string; pct: number }[]): Set<string> {
  const prev = useRef<Map<string, number>>(new Map());
  const [flash, setFlash] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const rose = items.filter((x) => (prev.current.get(x.id) ?? 0) < x.pct).map((x) => x.id);
    prev.current = new Map(items.map((x) => [x.id, x.pct]));
    if (rose.length) {
      setFlash(new Set(rose));
      const t = setTimeout(() => setFlash(new Set()), 900);
      return () => clearTimeout(t);
    }
  }, [items]);
  return flash;
}

/** Screen 1 - the vote per category: the chips, the three columns, the phone. */
function VoteScreen({ f, phone, voteSeconds, light }: { f: LiveFinalsView; phone: string; voteSeconds: number; light: boolean }) {
  const rows = f.finalists ?? [];
  const steps = f.steps ?? [];
  const open = steps.find((s) => s.status === "open") ?? null;
  const lastDone = [...steps].reverse().find((s) => s.status === "done") ?? null;
  const shown: LiveStep | null = open ?? lastDone ?? steps[0] ?? null;
  const idx = shown ? steps.indexOf(shown) : 0;
  const allDone = steps.length > 0 && steps.every((s) => s.status === "done");
  const items = rows.map((x) => {
    const cell = shown ? x.audience[shown.key] : undefined;
    return { id: x.id, n: x.n, name: x.name, pct: cell?.pct ?? 0, leading: cell?.leading ?? false };
  });
  const flash = useFlash(items);
  const left = useLeft(open?.openedAt ?? null, voteSeconds);
  const state = open ? "open" : allDone ? "done" : shown?.status === "done" ? "closed" : "paused";
  const title = shown?.label ?? f.name ?? "";
  return (
    <Frame kicker={`${f.name ? `${f.name} · ` : ""}קטגוריה ${idx + 1} מתוך ${steps.length} · מי הפרויקט הטוב ביותר ב־`} title={title} titleClass={title.length > 14 ? "long" : ""} light={light}>
      <div className="screen">
        <div className="steps">
          {steps.map((s) => (
            <div key={s.key} className={`chip ${s.status === "open" ? "on" : s.status === "done" ? "done" : ""}`}>
              {s.label}
            </div>
          ))}
        </div>
        <Columns items={items} hidePct={false} flash={flash} />
        <PhonePanel phone={phone} keys={rows.map((x) => x.n)} state={state} left={left} />
      </div>
    </Frame>
  );
}

const judges10 = (x: LiveFinalistRow, judgesMax: number) => (x.judgesScore === null || !judgesMax ? null : (x.judgesScore / judgesMax) * 10);
const audiencePct = (x: LiveFinalistRow, audienceMax: number) => {
  const cells = Object.values(x.audience);
  const scored = cells.filter((c) => c.score !== null);
  if (!scored.length || !audienceMax) return null;
  return (scored.reduce((s, c) => s + (c.score ?? 0), 0) / audienceMax) * 100;
};

/** Screen 2 - the judges' scores, before the reveal. */
function JudgesScreen({ f, light }: { f: LiveFinalsView; light: boolean }) {
  const rows = f.finalists ?? [];
  const judgesMax = f.weights?.judges ?? 70;
  const n = rows.length;
  const w = n > 3 ? Math.floor(Math.min(430, (1776 - 48 * (n - 1)) / n)) : 430;
  return (
    <Frame kicker="לפני החשיפה" title="ציוני השופטות" light={light}>
      <div className="judges">
        <div className="jrow">
          {rows.map((x, i) => {
            const s = judges10(x, judgesMax);
            return (
              <div key={x.id} className="jcard" style={{ borderColor: colorOf(i), width: w, animationDelay: `${i * 120}ms` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="key" style={{ width: 56, height: 56, fontSize: 32, background: colorOf(i) }}>
                    {x.n}
                  </div>
                  <Name name={x.name} />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div className="jscore">{s === null ? "—" : fmt1(s)}</div>
                  <div className="jof">/ 10</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="foot">ממוצע ציוני חבר השופטות · משקל השופטות בשקלול: {judgesMax}%</div>
      </div>
    </Frame>
  );
}

/** Screen 3 - the winner and the podium. The blocks rise one by one, then her name. */
function WinnerScreen({ f, fire, light }: { f: LiveFinalsView; fire: number; light: boolean }) {
  const rows = f.finalists ?? [];
  const judgesMax = f.weights?.judges ?? 70;
  const audienceMax = f.weights?.audience ?? 30;
  const ranked = [...rows].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.n - b.n);
  const winner = ranked.find((x) => x.rank === 1) ?? null;
  // 2 · 1 · 3, the rest after
  const order = ranked.length >= 3 ? [ranked[1], ranked[0], ranked[2], ...ranked.slice(3)] : ranked.length === 2 ? [ranked[0], ranked[1]] : ranked;
  const heights: Record<number, number> = { 1: 340, 2: 250, 3: 190 };
  const delayOf = (rank: number | null) => (rank === 1 ? 2.2 : rank === 2 ? 1.2 : 0.3);
  const n = order.length;
  const w = n > 3 ? Math.floor(Math.min(420, (1776 - 36 * (n - 1)) / n)) : 420;
  const nCats = f.categories?.length ?? 0;
  return (
    <Frame kicker="שקלול קהל ושופטות" title="והזוכה היא…" light={light}>
      <Confetti fire={fire} />
      <div className="results">
        {winner ? (
          <div className="winner" style={{ animationDelay: "3.1s" }}>
            <div className={`winner-name kr${winner.name.length > 18 ? " long" : ""}`} style={{ color: colorOf(rows.indexOf(winner)) }}>
              {winner.name}
            </div>
            <div className="winner-sub">
              ציון משוקלל <b>{fmt1(winner.total ?? 0)}</b>
            </div>
          </div>
        ) : (
          <div className="winner">
            <div className="winner-sub">עדיין אין ציונים</div>
          </div>
        )}
        <div className="podium">
          {order.map((x) => {
            const i = rows.indexOf(x);
            const a = audiencePct(x, audienceMax);
            const j = judges10(x, judgesMax);
            const d = delayOf(x.rank);
            return (
              <div key={x.id} className="pod" style={{ width: w }}>
                <div className="pod-head" style={{ animationDelay: `${d}s` }}>
                  <Name name={x.name} />
                  <div className="pod-stats">
                    <span>
                      קהל <b>{a === null ? "—" : `${Math.round(a)}%`}</b>
                    </span>
                    <span>
                      שופטות <b>{j === null ? "—" : fmt1(j)}</b>
                    </span>
                  </div>
                </div>
                <div className="pod-block" style={{ height: heights[x.rank ?? 0] ?? 150, background: colorOf(i), animationDelay: `${d}s` }}>
                  <div className="pod-rank">{x.rank ?? "—"}</div>
                  <div className="pod-total">{x.total === null ? "—" : fmt1(x.total)}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="baseline" />
        <div className="foot" style={{ marginTop: 16, fontSize: 25 }}>
          שקלול: {audienceMax}% הצבעות הקהל ב-{nCats} הקטגוריות · {judgesMax}% ציוני השופטות
        </div>
      </div>
    </Frame>
  );
}

/** A question outside the finals (an ice-breaker, a poll) - the same columns, percentages only. */
function QuestionScreen({ q, visible, phone, light }: { q: LiveQuestionView; visible: boolean; phone: string; light: boolean }) {
  const items = q.options.map((o) => ({ id: String(o.n), n: o.n, name: o.label, pct: o.pct ?? 0, leading: o.leading ?? false }));
  const flash = useFlash(items);
  return (
    <Frame kicker="הצבעת הקהל" title={q.text} titleClass="wrap" light={light}>
      <div className="screen">
        <Columns items={items} hidePct={!visible} flash={flash} />
        <PhonePanel phone={phone} keys={items.map((x) => x.n)} state={q.status === "open" ? "open" : "closed"} left={null} />
      </div>
    </Frame>
  );
}

/** The opening screen - the logos and the event's name, nothing else. */
function OpeningScreen({ name, light }: { name: string; light: boolean }) {
  return (
    <div className="scene">
      <div className="opening">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={light ? "/live/hackathon-color.png" : "/live/hackathon-white.png"} alt="האקתון AI 2026" style={{ height: 400, animation: "colIn .9s both" }} />
        <div className="ev kr">{name}</div>
        <div className="rule" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={light ? "/live/opencode-color.png" : "/live/opencode-white.png"} alt="קוד פתוח" style={{ height: 120, animation: "colIn .9s .4s both" }} />
      </div>
    </div>
  );
}

/* the stage's scale: 1920×1080 fitted into whatever screen shows it */
const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const scaleNow = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);

export function LiveDisplay({ initial, isAdmin, forcedTheme, fontClass }: { initial: LiveDisplayView; isAdmin: boolean; forcedTheme: "light" | "dark" | null; fontClass: string }) {
  const [view, setView] = useState<LiveDisplayView>(initial);
  const [sessionTheme, setSessionTheme] = useState<"light" | "dark" | null>(null);
  const [lastOk, setLastOk] = useState<number>(() => Date.now());
  const [stale, setStale] = useState(false);
  const [cursor, setCursor] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fire, setFire] = useState(0);
  const celebrated = useRef<string | null>(null);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = useSyncExternalStore(subscribeResize, scaleNow, () => 1);

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
  // which screen: the finals' vote, judges or winner when a challenge is on; a plain question when one runs; else the opening
  const finalsOn = !!f.active;
  const vote = finalsOn && f.status === "judging";
  const closed = finalsOn && f.status !== "judging";
  const judgesScreen = closed && !!f.hidden;
  const winnerScreen = closed && !f.hidden;
  const plainQ = !finalsOn && !!q && !q.category;
  const boardFinal = winnerScreen && (f.finalists ?? []).some((x) => x.rank === 1);

  useEffect(() => {
    const key = boardFinal ? `${f.active}:${f.revealed ? "r" : "l"}` : null;
    if (key && celebrated.current !== key) {
      celebrated.current = key;
      // after the podium rose and the name appeared
      const t = setTimeout(() => setFire(Date.now()), 3300);
      return () => clearTimeout(t);
    }
  }, [boardFinal, f.active, f.revealed]);

  const onMove = () => {
    setCursor(true);
    if (cursorTimer.current) clearTimeout(cursorTimer.current);
    cursorTimer.current = setTimeout(() => setCursor(false), 2500);
  };

  const theme = sessionTheme ?? forcedTheme ?? v.event.theme;
  const light = theme === "light";
  const phone = v.event.phone;
  const shownStep = (f.steps ?? []).find((s) => s.status === "open") ?? [...(f.steps ?? [])].reverse().find((s) => s.status === "done") ?? (f.steps ?? [])[0];
  const sceneKey = vote ? `vote:${f.active}:${shownStep?.key ?? ""}` : judgesScreen ? `judges:${f.active}` : winnerScreen ? `winner:${f.active}` : plainQ ? `q:${q!.id}` : "opening";
  const netText = stale ? "אין חיבור לשרת" : v.health.configured && v.health.error ? `ימות: ${v.health.error}` : null;

  return (
    <div className={`lv ${fontClass}${cursor ? " cursor" : ""}`} data-theme={theme} dir="rtl" onMouseMove={onMove}>
      <style>{CSS}</style>
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        <svg className="bracket" style={{ right: 20 }} aria-hidden="true" width="110" height="480" viewBox="0 0 110 480">
          <path d="M100 10 L14 240 L100 470" fill="none" stroke="var(--p1)" strokeWidth="16" />
        </svg>
        <svg className="bracket" style={{ left: 20 }} aria-hidden="true" width="110" height="480" viewBox="0 0 110 480">
          <path d="M10 10 L96 240 L10 470" fill="none" stroke="var(--p3)" strokeWidth="16" />
        </svg>
        <div key={sceneKey} style={{ position: "absolute", inset: 0 }}>
          {vote ? (
            <VoteScreen f={f} phone={phone} voteSeconds={v.event.voteSeconds} light={light} />
          ) : judgesScreen ? (
            <JudgesScreen f={f} light={light} />
          ) : winnerScreen ? (
            <WinnerScreen f={f} fire={fire} light={light} />
          ) : plainQ ? (
            <QuestionScreen q={q!} visible={v.resultsVisible} phone={phone} light={light} />
          ) : (
            <OpeningScreen name={v.event.name} light={light} />
          )}
        </div>
        {netText ? (
          <div className="net">
            <i />
            <span>{netText}</span>
          </div>
        ) : null}
        {toast ? <div className="toast">{toast}</div> : null}
      </div>
    </div>
  );
}
