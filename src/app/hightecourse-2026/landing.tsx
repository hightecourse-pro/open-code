"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, Users, User } from "lucide-react";
import { H, LOGO, TAGLINE } from "@/app/ai-course/theme";
import { CONTACT_EMAIL, DAY, PATHS, PRICE, nis } from "@/lib/conference-shared";
import { MARQUEE, NAMES, SCHEDULE } from "./content";

/*
  The conference's marketing page. Everything that moves, moves with the
  scroll: a yellow progress line at the top, the hero's shapes drift against
  the scroll (parallax), every block rises into view when it enters the
  screen (IntersectionObserver), the timeline's rail fills as she reads down
  the program, the topbar turns solid once the hero is gone, a countdown ticks
  to the opening. The brochure's own devices - the big yellow word with the
  grey offset, the navy block type, the handwritten asides - are the page's
  identity, on a pale-blue ground (the owner, 18.11: ״תן יותר טאצ׳ כחול״).
*/
const GREY = "#C9D8E5"; // the offset shadow - blue-grey, so it still shows on the pale-blue ground
const TINT = "#E6EFF7"; // the pale blue of the hero and the program
const REGISTER = PATHS.register;

function useScrollEffects(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // reveal on entry - once
    const targets = el.querySelectorAll<HTMLElement>(".hc-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
            e.target.classList.add("hc-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );
    targets.forEach((t) => io.observe(t));
    // the hero's own entrance needs no scroll
    requestAnimationFrame(() => el.querySelectorAll<HTMLElement>(".hc-hero .hc-reveal").forEach((t) => t.classList.add("hc-in")));

    const progress = el.querySelector<HTMLElement>(".hc-progress");
    const topbar = el.querySelector<HTMLElement>(".hc-topbar");
    const rail = el.querySelector<HTMLElement>(".hc-rail");
    const fill = el.querySelector<HTMLElement>(".hc-rail-fill");
    const dots = el.querySelectorAll<HTMLElement>(".hc-dot");
    const parallax = el.querySelectorAll<HTMLElement>("[data-parallax]");
    let raf = 0;
    const tick = () => {
      raf = 0;
      const y = window.scrollY;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      if (progress) progress.style.transform = `scaleX(${Math.min(1, y / max)})`;
      if (topbar) topbar.classList.toggle("hc-stuck", y > 80);
      parallax.forEach((p) => {
        const f = parseFloat(p.dataset.parallax || "0");
        p.style.transform = `translate3d(0, ${(y * f).toFixed(1)}px, 0)`;
      });
      if (rail && fill) {
        const r = rail.getBoundingClientRect();
        const line = window.innerHeight * 0.62;
        const t = Math.min(1, Math.max(0, (line - r.top) / r.height));
        fill.style.height = `${(t * 100).toFixed(2)}%`;
        dots.forEach((d) => {
          const b = d.getBoundingClientRect();
          d.classList.toggle("hc-dot-on", b.top + b.height / 2 <= line);
        });
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [root]);
}

function Countdown() {
  const [left, setLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  useEffect(() => {
    const target = Date.parse(DAY.startIso);
    const calc = () => {
      const diff = Math.max(0, target - Date.now());
      const s = Math.floor(diff / 1000);
      setLeft({ d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, []);
  if (!left) return <div className="hc-countdown" aria-hidden style={{ minHeight: 64 }} />;
  const cells: [number, string][] = [
    [left.d, "ימים"],
    [left.h, "שעות"],
    [left.m, "דקות"],
    [left.s, "שניות"],
  ];
  return (
    <div className="hc-countdown" data-testid="hc-countdown" aria-label="הזמן שנותר עד פתיחת היום">
      {cells.map(([n, label]) => (
        <div key={label} className="hc-cd-cell">
          <span className="hc-cd-num" dir="ltr">
            {String(n).padStart(2, "0")}
          </span>
          <span className="hc-cd-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function Landing() {
  const root = useRef<HTMLDivElement | null>(null);
  useScrollEffects(root);

  return (
    <div ref={root} className="hc-root" style={{ background: H.white, color: H.ink }}>
      <style>{`
        .hc-root { overflow-x: clip; }
        .hc-progress { position: fixed; inset-inline: 0; top: 0; height: 4px; background: ${H.yellow}; transform-origin: right center; transform: scaleX(0); z-index: 60; }
        .hc-topbar { position: fixed; inset-inline: 0; top: 0; z-index: 50; transition: background .35s ease, box-shadow .35s ease, padding .35s ease; padding: 14px 0; }
        .hc-topbar.hc-stuck { background: rgba(255,255,255,.94); backdrop-filter: blur(8px); box-shadow: 0 6px 24px rgba(0,72,120,.10); padding: 8px 0; }
        .hc-topbar .hc-logo { width: min(190px, 44vw); transition: width .35s ease; }
        .hc-topbar.hc-stuck .hc-logo { width: min(150px, 38vw); }
        .hc-reveal { opacity: 0; transform: translateY(30px); transition: opacity .75s ease, transform .85s cubic-bezier(.22,1,.36,1); transition-delay: var(--d, 0ms); will-change: opacity, transform; }
        .hc-reveal.hc-from-left { transform: translateX(-36px); }
        .hc-reveal.hc-from-right { transform: translateX(36px); }
        .hc-reveal.hc-pop { transform: scale(.86); }
        .hc-reveal.hc-in { opacity: 1; transform: none; }
        .hc-hero { position: relative; min-height: 100svh; display: flex; align-items: center; overflow: hidden; background: linear-gradient(180deg, #D8E7F3 0%, ${TINT} 45%, #fff 100%); }
        .hc-shape { position: absolute; pointer-events: none; }
        @keyframes hc-float { 0%,100% { transform: translate(0,0) rotate(0deg) } 50% { transform: translate(0,-18px) rotate(1.5deg) } }
        @keyframes hc-float2 { 0%,100% { transform: translate(0,0) } 50% { transform: translate(10px,14px) } }
        .hc-float { animation: hc-float 9s ease-in-out infinite; }
        .hc-float2 { animation: hc-float2 11s ease-in-out infinite; }
        .hc-word { font-weight: 900; line-height: .9; letter-spacing: -0.02em; }
        .hc-word-yellow { color: ${H.yellow}; text-shadow: 7px 7px 0 ${GREY}; }
        .hc-word-navy { color: ${H.navy}; text-shadow: 6px 6px 0 ${GREY}; }
        .hc-word-outline { color: #fff; -webkit-text-stroke: 3px ${H.navy}; paint-order: stroke fill; }
        .hc-pill { display: inline-flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 2px 14px; color: #fff; background: ${H.navy}; border-radius: 999px; padding: 12px 30px; font-weight: 800; box-shadow: 0 16px 34px rgba(0,72,120,.24); max-width: 100%; }
        .hc-pill > span { white-space: nowrap; }
        .hc-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; border-radius: 999px; font-weight: 800; transition: transform .25s ease, box-shadow .25s ease, background .25s ease; text-decoration: none; }
        .hc-btn:hover { transform: translateY(-2px); }
        .hc-btn-primary { position: relative; background: ${H.navy}; color: #fff; padding: 16px 34px; font-size: 19px; box-shadow: 0 14px 30px rgba(0,72,120,.28); }
        .hc-btn-primary:hover { background: ${H.navyDeep}; box-shadow: 0 18px 36px rgba(0,72,120,.34); }
        .hc-btn-primary::after { content: ""; position: absolute; inset: -4px; border-radius: 999px; border: 2px solid ${H.yellow}; opacity: 0; animation: hc-ring 2.6s ease-out 1.2s infinite; }
        @keyframes hc-ring { 0% { transform: scale(.96); opacity: .9 } 70% { transform: scale(1.14); opacity: 0 } 100% { opacity: 0 } }
        .hc-btn-yellow { background: ${H.yellow}; color: ${H.navy}; padding: 14px 30px; font-size: 17px; box-shadow: 0 12px 26px rgba(248,200,0,.35); }
        .hc-btn-yellow:hover { background: #FFD633; }
        .hc-btn-ghost { color: ${H.navy}; padding: 12px 10px; font-size: 16px; font-weight: 700; }
        .hc-btn-ghost svg { transition: transform .3s ease; }
        .hc-btn-ghost:hover svg { transform: translateY(4px); }
        .hc-countdown { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .hc-cd-cell { display: flex; flex-direction: column; align-items: center; min-width: 74px; padding: 10px 12px; border-radius: 18px; background: ${H.navy}; color: #fff; }
        .hc-cd-num { font-size: 32px; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
        .hc-cd-label { font-size: 12.5px; margin-top: 4px; color: ${H.yellow}; font-weight: 700; }
        .hc-marquee { background: ${H.yellow}; color: ${H.navy}; overflow: hidden; padding: 14px 0; font-weight: 800; font-size: 17px; }
        .hc-track { display: flex; width: max-content; gap: 0; animation: hc-marquee 38s linear infinite; }
        .hc-track:hover { animation-play-state: paused; }
        @keyframes hc-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .hc-track span { display: inline-flex; align-items: center; gap: 22px; padding-inline: 22px; white-space: nowrap; }
        .hc-track i { width: 9px; height: 9px; border-radius: 50%; background: ${H.navy}; display: inline-block; }
        .hc-hand { font-style: italic; color: ${H.navy}; opacity: .85; }
        .hc-timeline { position: relative; }
        .hc-rail { position: absolute; inset-inline-start: 83px; top: 10px; bottom: 10px; width: 4px; background: ${GREY}; border-radius: 4px; }
        .hc-rail-fill { position: absolute; inset-inline-start: 0; top: 0; width: 100%; height: 0; background: ${H.yellow}; border-radius: 4px; transition: height .15s linear; }
        .hc-row { position: relative; display: grid; grid-template-columns: 60px 30px 1fr; gap: 0 10px; padding: 14px 0; }
        .hc-row .hc-row-time { font-weight: 900; color: ${H.navy}; font-size: 18px; font-variant-numeric: tabular-nums; padding-top: 2px; }
        .hc-dot { position: absolute; inset-inline-start: 77px; top: 20px; width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 3px solid ${GREY}; transition: border-color .3s ease, transform .3s ease, background .3s ease; }
        .hc-dot.hc-dot-on { border-color: ${H.navy}; background: ${H.yellow}; transform: scale(1.25); }
        .hc-row-body { background: #fff; border-radius: 18px; padding: 14px 18px; box-shadow: 0 8px 22px rgba(0,72,120,.08); }
        .hc-row-title { font-weight: 800; color: ${H.ink}; font-size: 17.5px; }
        .hc-row-sub { color: ${H.muted}; font-size: 15.5px; margin-top: 2px; }
        .hc-name { color: ${H.navy}; font-weight: 900; padding: 0 3px; box-shadow: inset 0 -0.42em ${H.yellowSoft}; }
        .hc-track .hc-name { background: ${H.navy}; color: ${H.yellow}; padding: 2px 12px; border-radius: 999px; box-shadow: none; }
        .hc-big { font-size: 1.5em; font-weight: 900; color: ${H.navy}; line-height: 1; }
        .hc-row-flex { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .hc-row-logo { height: 46px; width: auto; flex: none; }
        .hc-price { border-radius: 30px; padding: 30px 28px; position: relative; overflow: hidden; }
        .hc-price-single { background: ${TINT}; }
        .hc-price-group { background: ${H.navy}; color: #fff; }
        .hc-badge { position: absolute; top: 34px; left: -48px; width: 200px; text-align: center; transform: rotate(-45deg); background: ${H.yellow}; color: ${H.navy}; font-weight: 800; font-size: 13px; padding: 7px 0; box-shadow: 0 6px 16px rgba(0,0,0,.18); }
        .hc-strike { position: relative; display: inline-block; opacity: .85; line-height: 1; }
        .hc-strike::after { content: ""; position: absolute; inset-inline: -5px; top: 46%; height: 3px; background: ${H.yellow}; transform: rotate(-6deg) scaleX(0); transform-origin: right; transition: transform .6s ease .6s; }
        .hc-in .hc-strike::after { transform: rotate(-8deg) scaleX(1); }
        .hc-wave { display: block; width: 100%; height: auto; }
        @media (max-width: 640px) {
          .hc-rail { inset-inline-start: 70px; }
          .hc-dot { inset-inline-start: 64px; }
          .hc-row { grid-template-columns: 52px 24px 1fr; gap: 0 8px; }
          .hc-pill { font-size: 17px; padding: 9px 18px; gap: 2px 10px; }
          .hc-row .hc-row-time { font-size: 16px; }
          .hc-word-yellow, .hc-word-navy { text-shadow: 4px 4px 0 ${GREY}; }
        }
      `}</style>

      <div className="hc-progress" aria-hidden />

      {/* top bar */}
      <header className="hc-topbar">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5">
          <Link href={PATHS.landing} aria-label="הייטקורס" className="shrink-0">
            <Image src={LOGO.src} alt={LOGO.alt} width={LOGO.width} height={LOGO.height} priority className="hc-logo h-auto" />
          </Link>
          <nav className="hidden items-center gap-7 text-[15.5px] font-bold sm:flex" style={{ color: H.navy }}>
            <a href="#schedule" className="hover:underline underline-offset-4" style={{ color: H.navy }}>
              התוכנית
            </a>
            <a href="#pricing" className="hover:underline underline-offset-4" style={{ color: H.navy }}>
              מחירים
            </a>
          </nav>
          <Link href={REGISTER} className="hc-btn hc-btn-yellow !px-5 !py-2.5 !text-[15px]" data-testid="hc-top-cta">
            הרשמי עכשיו
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="hc-hero">
        {/* the brochure's shapes: a pale-blue disc with a dashed ring high on the right, the yellow/navy band low */}
        <div className="hc-shape" style={{ right: "-12%", top: "-22%", width: "58%", maxWidth: 760 }} data-parallax="0.18" aria-hidden>
          <div className="hc-float">
            <svg viewBox="0 0 600 600" className="hc-wave">
              <path d="M300 20c160 0 290 110 290 270S460 590 300 590 10 460 10 290 140 20 300 20z" fill="#CDE0EF" />
              <path d="M330 90c120 0 210 90 210 210S450 500 330 500 120 420 120 300 210 90 330 90z" fill="none" stroke={H.navy} opacity=".3" strokeWidth="10" strokeDasharray="22 16" />
            </svg>
          </div>
        </div>
        {/* the brochure's bottom band - yellow over navy, edge to edge, so it never shows a cut */}
        <div className="hc-shape" style={{ left: 0, right: 0, bottom: "-8%", height: "44%" }} data-parallax="-0.08" aria-hidden>
          <div className="hc-float2" style={{ height: "100%" }}>
            <svg viewBox="0 0 1440 500" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
              <path d="M0 250C200 110 420 80 640 180s480 190 800 60V500H0z" fill={H.yellow} />
              <path d="M0 330c220-140 420-130 640-40s500 120 800 10V500H0z" fill={H.navy} opacity=".94" />
            </svg>
          </div>
        </div>

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 pb-24 pt-32 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-36">
          <div>
            <h1 className="flex flex-col items-start leading-none">
              <span className="hc-reveal hc-from-right hc-word hc-word-navy text-[46px] sm:text-[70px]" style={{ ["--d" as string]: "120ms" }}>
                כשחדשנות
              </span>
              {" "}
              <span className="hc-reveal hc-from-left hc-word hc-word-outline mt-2 text-[46px] sm:text-[70px]" style={{ ["--d" as string]: "280ms" }}>
                פוגשת
              </span>
              {" "}
              <span className="hc-reveal hc-pop hc-word hc-word-yellow text-[96px] sm:text-[150px] lg:text-[170px]" style={{ ["--d" as string]: "440ms" }}>
                אווירה
              </span>
            </h1>
            <p className="hc-reveal mt-6 max-w-xl text-[17px] leading-relaxed sm:text-[19px]" style={{ color: H.ink, ["--d" as string]: "540ms" }} data-testid="hc-hero-text">
              ה-AI מייעל את העבודה, מעלה את הקצב. <b style={{ color: H.navy }}>אבל איך הוא משפיע עלינו?</b>
              <br className="hidden sm:inline" />
              יום שלם של <b style={{ color: H.navy }}>דיון, שיקוף וידע מקצועי</b> על השפעת ה-AI עלינו <b style={{ color: H.navy }}>כבני אדם</b>,
              <br className="hidden sm:inline" />
              והדרך <b style={{ color: H.navy }}>לשמור על שפיות</b> בעולם התזזיתי שלנו.
            </p>
            <div className="hc-reveal mt-7" style={{ ["--d" as string]: "640ms" }}>
              <span className="hc-pill text-[20px] sm:text-[26px]" data-testid="hc-date">
                <span>{DAY.label}</span>
                <span aria-hidden style={{ color: H.yellow }}>
                  |
                </span>
                <span dir="ltr">{DAY.date}</span>
                <span aria-hidden style={{ color: H.yellow }}>
                  |
                </span>
                <span>{DAY.hebrew}</span>
              </span>
            </div>
            <div className="hc-reveal mt-8 flex flex-wrap items-center gap-4" style={{ ["--d" as string]: "760ms" }}>
              <Link href={REGISTER} className="hc-btn hc-btn-primary" data-testid="hc-hero-cta">
                הרשמי עכשיו
                <ArrowLeft size={20} strokeWidth={2.6} />
              </Link>
              <a href="#schedule" className="hc-btn hc-btn-ghost">
                לתוכנית היום
                <ArrowDown size={18} strokeWidth={2.6} />
              </a>
            </div>
          </div>
          <div className="hc-reveal hc-from-left lg:justify-self-end" style={{ ["--d" as string]: "700ms" }}>
            <div className="rounded-[32px] bg-white/90 p-6 text-center shadow-[0_24px_60px_rgba(0,72,120,.18)] backdrop-blur sm:p-8" style={{ border: `3px solid ${H.navy}` }} data-testid="hc-cd-card">
              <p className="text-[15px] font-bold" style={{ color: H.navy }}>
                הדלתות נפתחות בעוד
              </p>
              <div className="mt-4">
                <Countdown />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-[14.5px]">
                <div className="rounded-2xl px-4 py-3" style={{ background: TINT }}>
                  <div className="font-black text-[22px]" style={{ color: H.navy }}>
                    08:00
                  </div>
                  <div style={{ color: H.muted }}>התכנסות ובופה בוקר</div>
                </div>
                <div className="rounded-2xl px-4 py-3" style={{ background: TINT }}>
                  <div className="font-black text-[22px]" style={{ color: H.navy }}>
                    17:00
                  </div>
                  <div style={{ color: H.muted }}>סיום</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* the yellow band */}
      {/* the yellow band */}
      <div className="hc-marquee" aria-hidden>
        <div className="hc-track" dir="ltr">
          {[0, 1].map((copy) => (
            <span key={copy} dir="rtl">
              {MARQUEE.map((m) => (
                <span key={m}>
                  {markup(m, marks(NAMES))}
                  <i />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* the full program */}
      <section id="schedule" className="relative overflow-hidden py-20 sm:py-24" style={{ background: TINT }}>
        <div className="hc-shape" style={{ left: "-10%", top: "6%", width: "36%", maxWidth: 420, opacity: 0.9 }} data-parallax="0.08" aria-hidden>
          <svg viewBox="0 0 400 400" className="hc-wave">
            <circle cx="200" cy="200" r="190" fill="none" stroke={H.navy} opacity=".28" strokeWidth="8" strokeDasharray="18 14" />
          </svg>
        </div>
        <div className="relative mx-auto max-w-4xl px-5">
          <div className="hc-reveal">
            <h2 className="text-[34px] font-black leading-tight sm:text-[46px]" style={{ color: H.navy }}>
              התוכנית המלאה
            </h2>
            <p className="mt-2 text-[17px] font-bold" style={{ color: H.muted }}>
              {DAY.label} | ט״ז כסלו | <span dir="ltr">26.11</span>
            </p>
          </div>
          <div className="hc-timeline mt-10" data-testid="hc-schedule">
            <div className="hc-rail" aria-hidden>
              <div className="hc-rail-fill" />
            </div>
            {SCHEDULE.map((s, i) => (
              <div key={s.time} className="hc-row hc-reveal hc-from-right" style={{ ["--d" as string]: `${Math.min(i, 4) * 60}ms` }}>
                <div className="hc-dot" aria-hidden />
                <div className="hc-row-time" dir="ltr">
                  {s.time}
                </div>
                <div aria-hidden />
                <div className={`hc-row-body${s.logo ? " hc-row-flex" : ""}`}>
                  <div>
                    <div className="hc-row-title">{markup(s.title, marks(s.names, s.big))}</div>
                    {s.sub && <div className="hc-row-sub">{markup(s.sub, marks(s.names))}</div>}
                    {s.hand && <div className="hc-hand mt-1 text-[15px]">{s.hand}</div>}
                  </div>
                  {s.logo && <Image src={s.logo.src} alt={s.logo.alt} width={s.logo.width} height={s.logo.height} className="hc-row-logo" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
        <div className="grid gap-6 md:grid-cols-2" data-testid="hc-pricing">
          <div className="hc-price hc-price-single hc-reveal hc-from-right">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: H.white, color: H.navy }}>
                <User size={24} strokeWidth={2.4} />
              </span>
              <h3 className="text-[24px] font-black" style={{ color: H.navy }}>
                משתתפת יחידה
              </h3>
            </div>
            <div className="mt-6 flex items-end gap-2">
              <span className="text-[58px] font-black leading-none" style={{ color: H.navy }} dir="ltr">
                {nis(PRICE.single)}
              </span>
              <span className="pb-2 text-[22px] font-black" style={{ color: H.navy }}>
                ₪
              </span>
            </div>
            <p className="mt-3 text-[15.5px]" style={{ color: H.muted }}>
              יום שלם, כולל בופה בוקר וארוחת צהריים.
            </p>
            <Link href={`${REGISTER}?kind=single`} className="hc-btn hc-btn-primary mt-7 w-full sm:w-auto" data-testid="hc-price-single-cta">
              הרשמי עכשיו
              <ArrowLeft size={18} strokeWidth={2.6} />
            </Link>
          </div>
          <div className="hc-price hc-price-group hc-reveal hc-from-left" style={{ ["--d" as string]: "140ms" }}>
            <div className="hc-badge">מחיר מיוחד לקבוצות</div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,.14)", color: H.yellow }} data-testid="hc-group-icon">
                <Users size={24} strokeWidth={2.4} />
              </span>
              <h3 className="text-[24px] font-black text-white">קבוצה - מעל {PRICE.groupMin - 1} משתתפות</h3>
            </div>
            <div className="mt-6 flex items-end gap-3">
              <span className="text-[58px] font-black leading-none" style={{ color: H.yellow }} dir="ltr">
                {nis(PRICE.group)}
              </span>
              <span className="pb-2 text-[22px] font-black" style={{ color: H.yellow }}>
                ₪
              </span>
              <span className="hc-strike mb-2 text-[26px] font-bold text-white" data-testid="hc-price-strike">
                {nis(PRICE.single)} ₪
              </span>
            </div>
            <p className="mt-3 text-[15.5px]" style={{ color: "#C9D9E6" }}>
              למשתתפת, לקבוצה של {PRICE.groupMin} משתתפות ומעלה. איש קשר אחד, חשבונית אחת, כל המשתתפות ברישום אחד.
            </p>
            <Link href={`${REGISTER}?kind=group`} className="hc-btn hc-btn-yellow mt-7 w-full sm:w-auto" data-testid="hc-price-group-cta">
              להרשמת הקבוצה
              <ArrowLeft size={18} strokeWidth={2.6} />
            </Link>
          </div>
        </div>
      </section>

      {/* closing call */}
      <section className="relative overflow-hidden" style={{ background: H.navy }}>
        <div className="hc-shape" style={{ right: "-6%", bottom: "-50%", width: "40%", maxWidth: 520, opacity: 0.9 }} data-parallax="-0.06" aria-hidden>
          <svg viewBox="0 0 400 400" className="hc-wave">
            <circle cx="200" cy="200" r="200" fill={H.yellow} />
          </svg>
        </div>
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-5 py-20 text-center sm:py-24">
          <h2 className="hc-reveal text-[36px] font-black leading-tight text-white sm:text-[52px]">
            לשמור לך <span style={{ color: H.yellow }}>מקום?</span>
          </h2>
          <p className="hc-reveal mt-4 max-w-xl text-[17px] leading-relaxed" style={{ color: "#C9D9E6", ["--d" as string]: "120ms" }}>
            {DAY.label}, <span dir="ltr">{DAY.date}</span>, {DAY.hebrew}. ההרשמה לוקחת שתי דקות.
          </p>
          <Link href={REGISTER} className="hc-btn hc-btn-yellow hc-reveal hc-pop mt-8" style={{ ["--d" as string]: "240ms" }} data-testid="hc-bottom-cta">
            הרשמי עכשיו
            <ArrowLeft size={20} strokeWidth={2.6} />
          </Link>
        </div>
      </section>

      <footer className="w-full" style={{ background: H.navyDeep }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-5 text-[13.5px] text-white">
          <span className="font-bold" style={{ color: H.yellow }}>
            {TAGLINE}
          </span>
          <span aria-hidden style={{ color: H.yellow }}>
            |
          </span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline" dir="ltr" style={{ color: H.white }}>
            {CONTACT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}

type Mark = { text: string; cls: string };

function marks(names?: string[], big?: string): Mark[] {
  const out: Mark[] = (names ?? []).map((n) => ({ text: n, cls: "hc-name" }));
  if (big) out.push({ text: big, cls: "hc-big" });
  return out;
}

/** The brochure sets the speakers' names in navy - here they get a marker too (the owner: ״תדגיש את השמות בכל מקום״); `big` enlarges one word. */
function markup(text: string, ms: Mark[]): React.ReactNode {
  if (!ms.length) return text;
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length) {
    let found: { i: number; m: Mark } | null = null;
    for (const m of ms) {
      const i = rest.indexOf(m.text);
      if (i >= 0 && (!found || i < found.i)) found = { i, m };
    }
    if (!found) {
      parts.push(rest);
      break;
    }
    if (found.i > 0) parts.push(rest.slice(0, found.i));
    parts.push(
      <span key={key++} className={found.m.cls}>
        {found.m.text}
      </span>
    );
    rest = rest.slice(found.i + found.m.text.length);
  }
  return parts;
}
