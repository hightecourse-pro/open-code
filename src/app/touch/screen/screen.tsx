"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TOUCH_Q, TOUCH_QUESTIONS, percents, type TouchResults } from "../content";

/*
  The LED wall. Scenes 0-9 = one question each (bars and columns in turn),
  scene 10 = the ten leading answers together. The feed is read every 3 s and
  the charts move in place when numbers change. Keys: ← next, → previous,
  space = hold / go on, F = full screen.
*/

const W = 3840;
const H = 960;
const POLL_MS = 3000;
const SCENES = TOUCH_Q + 1;

const onResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const screenSize = () => `${innerWidth}x${innerHeight}`;
const serverSize = () => "1920x480";

function useCountUp(target: number, ms = 1100): number {
  const [v, setV] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const from = cur.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const val = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      cur.current = val;
      setV(val);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Num({ value, suffix = "" }: { value: number; suffix?: string }) {
  const v = useCountUp(value);
  return (
    <span dir="ltr">
      {v}
      {suffix}
    </span>
  );
}

export function Screen({ initial, fontClass, stretch, locked, seconds }: { initial: TouchResults; fontClass: string; stretch: boolean; locked: number | null; seconds: number }) {
  const [data, setData] = useState(initial);
  const [auto, setAuto] = useState(0);
  const [held, setHeld] = useState(false);
  const scene = locked ?? auto;
  const size = useSyncExternalStore(onResize, screenSize, serverSize);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/hc-touch", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as TouchResults;
        if (alive && Array.isArray(j.counts)) setData(j);
      } catch {
        /* the next round will do */
      }
    };
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const sceneMs = (scene === TOUCH_Q ? seconds * 1.6 : seconds) * 1000;
  useEffect(() => {
    if (locked !== null || held) return;
    const t = setTimeout(() => setAuto((s) => (s + 1) % SCENES), sceneMs);
    return () => clearTimeout(t);
  }, [auto, locked, held, sceneMs]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "PageDown") setAuto((s) => (s + 1) % SCENES);
      else if (e.key === "ArrowRight" || e.key === "PageUp") setAuto((s) => (s + SCENES - 1) % SCENES);
      else if (e.key === " ") setHeld((h) => !h);
      else if (e.key === "f" || e.key === "F" || e.key === "כ") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => {});
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const [vw, vh] = size.split("x").map(Number);
  const sx = vw / W;
  const sy = vh / H;
  const s = Math.min(sx, sy);
  const transform = stretch ? `scale(${sx},${sy})` : `scale(${s})`;

  return (
    <div className={`hcs ${fontClass}`} dir="rtl" data-testid="touch-screen" data-scene={scene} data-total={data.total}>
      <div className={`hcs-stage${stretch ? " stretch" : ""}`} style={{ transform }}>
        <div className="hcs-bg" aria-hidden>
          <i className="b1" />
          <i className="b2" />
          <i className="b3" />
          <i className="grid" />
        </div>
        {scene < TOUCH_Q ? <QuestionScene key={scene} index={scene} data={data} /> : <Summary key="all" data={data} />}
        <div className="hcs-progress" aria-hidden>
          {Array.from({ length: SCENES }, (_, i) => (
            <i key={i} className={i < scene ? "done" : i === scene ? "now" : ""}>
              {i === scene && locked === null && !held && <b key={`${scene}`} style={{ animationDuration: `${sceneMs}ms` }} />}
            </i>
          ))}
        </div>
      </div>
    </div>
  );
}

function Brand({ total }: { total: number }) {
  return (
    <div className="hcs-brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ai-course/hightecourse-dark.png" alt="הייטקורס" />
      <div className="hcs-total" data-testid="screen-total">
        <strong>
          <Num value={total} />
        </strong>
        <span>
          כבר נתנו
          <br />
          את הטאצ&apos;
        </span>
      </div>
    </div>
  );
}

function QuestionScene({ index, data }: { index: number; data: TouchResults }) {
  const question = TOUCH_QUESTIONS[index];
  const row = data.counts[index] ?? [0, 0, 0, 0];
  const pct = percents(row);
  const max = Math.max(...pct);
  const columns = index % 2 === 1;
  const size = (p: number) => (max ? `${Math.max(3, (p / max) * 100)}%` : "0%");

  return (
    <div className="hcs-scene" data-testid="screen-question" data-layout={columns ? "columns" : "bars"}>
      <aside className="hcs-side">
        <Brand total={data.total} />
        <div className="hcs-qwrap">
          <div className="hcs-chip">
            שאלה <b dir="ltr">{index + 1}</b> מתוך {TOUCH_Q}
          </div>
          <h1 className={`hcs-q${question.q.length > 55 ? " long" : ""}`}>{question.q}</h1>
        </div>
      </aside>

      {columns ? (
        <section className="hcs-cols">
          {question.a.map((text, a) => (
            <div key={a} className={`hcs-col${max > 0 && pct[a] === max ? " lead" : ""}`} style={{ animationDelay: `${200 + a * 140}ms` }}>
              <div className="plot">
                <div className="bar" style={{ height: size(pct[a]) }}>
                  <div className="pct">
                    <Num value={pct[a]} suffix="%" />
                  </div>
                  <i style={{ animationDelay: `${350 + a * 140}ms` }} />
                </div>
              </div>
              <div className={`label${text.length > 34 ? " long" : ""}`}>{text}</div>
            </div>
          ))}
        </section>
      ) : (
        <section className="hcs-bars">
          {question.a.map((text, a) => (
            <div key={a} className={`hcs-bar${max > 0 && pct[a] === max ? " lead" : ""}`} style={{ animationDelay: `${200 + a * 140}ms` }}>
              <div className={`label${text.length > 34 ? " long" : ""}`}>{text}</div>
              <div className="track">
                <div className="fill" style={{ width: size(pct[a]) }}>
                  <i style={{ animationDelay: `${350 + a * 140}ms` }} />
                </div>
              </div>
              <div className="pct">
                <Num value={pct[a]} suffix="%" />
              </div>
            </div>
          ))}
        </section>
      )}
      {max === 0 && <div className="hcs-wait">מחכות לטאצ&apos; הראשון</div>}
    </div>
  );
}

function Summary({ data }: { data: TouchResults }) {
  return (
    <div className="hcs-scene all" data-testid="screen-summary">
      <header className="hcs-allhead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ai-course/hightecourse-dark.png" alt="הייטקורס" />
        <h1>
          הטאצ&apos; שלכן <b>במבט אחד</b>
        </h1>
        <div className="hcs-total row">
          <strong>
            <Num value={data.total} />
          </strong>
          <span>כבר נתנו את הטאצ&apos;</span>
        </div>
      </header>
      <section className="hcs-grid">
        {TOUCH_QUESTIONS.map((question, i) => {
          const pct = percents(data.counts[i] ?? []);
          const max = Math.max(0, ...pct);
          const lead = max ? pct.indexOf(max) : -1;
          return (
            <article key={i} className="hcs-tile" style={{ animationDelay: `${120 + i * 90}ms` }}>
              <div className="top">
                <span className="n" dir="ltr">
                  {i + 1}
                </span>
                <span className="p">{lead >= 0 ? <Num value={max} suffix="%" /> : "—"}</span>
              </div>
              <p className="q">{question.q}</p>
              <p className="a">{lead >= 0 ? question.a[lead] : "מחכות לטאצ' הראשון"}</p>
              <div className="mini">
                <i style={{ width: `${max}%` }} />
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
