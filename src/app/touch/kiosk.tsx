"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TOUCH_Q, TOUCH_QUESTIONS } from "./content";

/*
  The kiosk. Three screens: start → quiz (10 questions, one tap each) → done.
  - Every answer is sent the moment it is tapped; what the network refuses
    waits in localStorage and is retried, so a Wi-Fi hiccup loses nothing.
  - A run that is left in the middle goes back to the opening after IDLE_MS
    without a touch, so the next woman never meets someone else's question.
  - The done screen returns to the opening after DONE_MS (or on a tap).
*/

const IDLE_MS = 45_000;
const DONE_MS = 7_000;
const PICK_MS = 520;
const QUEUE_KEY = "hc-touch-queue";
const LETTERS = ["א", "ב", "ג", "ד"];

type Item = { sid: string; q: number; a: number };
type Phase = "start" | "quiz" | "done";

function newSid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const h = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${h(8)}-${h(4)}-4${h(3)}-a${h(3)}-${h(12)}`;
}

function readQueue(): Item[] {
  try {
    const v = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(v) ? (v as Item[]) : [];
  } catch {
    return [];
  }
}
function writeQueue(q: Item[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-500)));
  } catch {
    /* a private window - the memory copy still works */
  }
}

export function Kiosk({ fontClass }: { fontClass: string }) {
  const [phase, setPhase] = useState<Phase>("start");
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(() => TOUCH_QUESTIONS.map(() => null));
  const [full, setFull] = useState(false);

  const sid = useRef("");
  const queue = useRef<Item[]>([]);
  const sending = useRef(false);
  const lastTouch = useRef(0);
  const busy = useRef(false);
  const canvas = useRef<HTMLCanvasElement>(null);

  const flush = useCallback(async () => {
    if (sending.current || !queue.current.length) return;
    sending.current = true;
    const batch = queue.current.slice(0, 40);
    try {
      const r = await fetch("/api/hc-touch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: batch }), keepalive: true });
      // 400 = the server will never take these - drop them; anything else failing stays for the next round
      if (r.ok || r.status === 400) {
        queue.current = queue.current.filter((x) => !batch.includes(x));
        writeQueue(queue.current);
      }
    } catch {
      /* offline - retried by the interval */
    } finally {
      sending.current = false;
    }
  }, []);

  useEffect(() => {
    queue.current = readQueue();
    void flush();
    const t = setInterval(() => void flush(), 4000);
    return () => clearInterval(t);
  }, [flush]);

  const toStart = useCallback(() => {
    busy.current = false;
    setPhase("start");
    setIdx(0);
    setPicked(null);
    setAnswers(TOUCH_QUESTIONS.map(() => null));
  }, []);

  // any touch keeps the run alive; a run left alone goes back to the opening
  useEffect(() => {
    const touch = () => {
      lastTouch.current = Date.now();
    };
    touch();
    window.addEventListener("pointerdown", touch, { passive: true });
    const t = setInterval(() => {
      if (phase === "quiz" && Date.now() - lastTouch.current > IDLE_MS) toStart();
    }, 1000);
    return () => {
      window.removeEventListener("pointerdown", touch);
      clearInterval(t);
    };
  }, [phase, toStart]);

  // the done screen: confetti, then the opening again
  useEffect(() => {
    if (phase !== "done") return;
    const stop = canvas.current ? confetti(canvas.current) : () => {};
    const t = setTimeout(toStart, DONE_MS);
    return () => {
      clearTimeout(t);
      stop();
    };
  }, [phase, toStart]);

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  const start = () => {
    sid.current = newSid();
    setAnswers(TOUCH_QUESTIONS.map(() => null));
    setIdx(0);
    setPicked(null);
    setPhase("quiz");
  };

  const pick = (a: number) => {
    if (busy.current) return;
    busy.current = true;
    setPicked(a);
    setAnswers((prev) => prev.map((v, i) => (i === idx ? a : v)));
    queue.current.push({ sid: sid.current, q: idx + 1, a: a + 1 });
    writeQueue(queue.current);
    void flush();
    setTimeout(() => {
      busy.current = false;
      setPicked(null);
      if (idx + 1 >= TOUCH_Q) setPhase("done");
      else setIdx(idx + 1);
    }, PICK_MS);
  };

  const back = () => {
    if (busy.current) return;
    if (idx === 0) toStart();
    else setIdx(idx - 1);
  };

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const question = TOUCH_QUESTIONS[idx];

  return (
    <div className={`hct ${fontClass}`} dir="rtl" data-testid="touch" data-phase={phase} onContextMenu={(e) => e.preventDefault()}>
      <div className="hct-bg" aria-hidden>
        <i className="b1" />
        <i className="b2" />
        <i className="b3" />
        <i className="ring r1" />
        <i className="ring r2" />
      </div>

      {phase === "start" && (
        <main className="hct-start" key="start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hct-logo" src="/ai-course/hightecourse-dark.png" alt="הייטקורס" draggable={false} />
          <h1 className="hct-title">
            <span>תני לנו את</span> <b>הטאצ&apos; שלך</b>
          </h1>
          <div className="hct-go-wrap">
            <i className="pulse p1" aria-hidden />
            <i className="pulse p2" aria-hidden />
            <i className="pulse p3" aria-hidden />
            <button type="button" className="hct-go" onClick={start} data-testid="touch-start">
              מתחילים?
            </button>
          </div>
          <p className="hct-anon">10 שאלות · אנונימי</p>
          {!full && (
            <button type="button" className="hct-full" onClick={toggleFull} aria-label="מסך מלא" data-testid="touch-full">
              ⛶
            </button>
          )}
        </main>
      )}

      {phase === "quiz" && (
        <main className="hct-quiz">
          <header className="hct-head">
            <button type="button" className="hct-back" onClick={back} data-testid="touch-back">
              חזרה
            </button>
            <div className="hct-steps" aria-hidden>
              {TOUCH_QUESTIONS.map((_, i) => (
                <i key={i} className={i < idx ? "done" : i === idx ? "now" : ""} />
              ))}
            </div>
            <div className="hct-count" dir="ltr" data-testid="touch-count">
              {idx + 1} / {TOUCH_Q}
            </div>
          </header>
          <section className="hct-card" key={idx}>
            <h2 className="hct-q" data-testid="touch-question">
              {question.q}
            </h2>
            <div className="hct-answers">
              {question.a.map((text, a) => (
                <button
                  type="button"
                  key={a}
                  className={`hct-a${picked === a ? " picked" : ""}${picked === null && answers[idx] === a ? " was" : ""}${picked !== null && picked !== a ? " dim" : ""}`}
                  style={{ animationDelay: `${120 + a * 70}ms` }}
                  onClick={() => pick(a)}
                  data-testid="touch-answer"
                >
                  <span className="l">{LETTERS[a]}</span>
                  <span className="t">{text}</span>
                </button>
              ))}
            </div>
          </section>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hct-logo small" src="/ai-course/hightecourse-dark.png" alt="" draggable={false} />
        </main>
      )}

      {phase === "done" && (
        <main className="hct-done" key="done" onClick={toStart} data-testid="touch-done">
          <div className="hct-check" aria-hidden>
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" />
              <path d="M36 62 l17 17 l32 -36" />
            </svg>
          </div>
          <h1 className="hct-title done">
            <span>יש לנו את</span> <b>הטאצ&apos; שלך!</b>
          </h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hct-logo" src="/ai-course/hightecourse-dark.png" alt="הייטקורס" draggable={false} />
        </main>
      )}

      <canvas ref={canvas} className="hct-confetti" aria-hidden />
    </div>
  );
}

/** A burst from both lower corners and a rain from above; returns the stop function. */
function confetti(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = (canvas.width = innerWidth * dpr);
  const H = (canvas.height = innerHeight * dpr);
  const unit = Math.min(W, H) / 100;
  const colors = ["#F8C800", "#FFFFFF", "#5EC2FF", "#FF5E9C", "#7CE3B1", "#FFD84D"];
  type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string; round: boolean };
  const parts: P[] = [];
  const add = (x: number, y: number, vx: number, vy: number) =>
    parts.push({ x, y, vx, vy, w: unit * (1 + Math.random() * 1.4), h: unit * (0.6 + Math.random() * 1.6), r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)], round: Math.random() < 0.25 });
  for (let i = 0; i < 110; i++) {
    const p = 1.6 + Math.random() * 2.2;
    add(0, H, unit * p * (0.3 + Math.random()), -unit * p * (0.8 + Math.random() * 0.6));
    add(W, H, -unit * p * (0.3 + Math.random()), -unit * p * (0.8 + Math.random() * 0.6));
  }
  for (let i = 0; i < 120; i++) add(Math.random() * W, -Math.random() * H * 0.9, (Math.random() - 0.5) * unit * 0.4, unit * (0.3 + Math.random() * 0.6));
  let raf = 0;
  let last = performance.now();
  const tick = (now: number) => {
    const k = Math.min(2.5, (now - last) / 16.7);
    last = now;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += unit * 0.035 * k;
      p.vx *= 1 - 0.012 * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.r += p.vr * k;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, 6.3);
        ctx.fill();
      } else ctx.fillRect(-p.w / 2, (-p.h / 2) * Math.cos(p.r * 2), p.w, p.h * Math.cos(p.r * 2));
      ctx.restore();
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, W, H);
  };
}
