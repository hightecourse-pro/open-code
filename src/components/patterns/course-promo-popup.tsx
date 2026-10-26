"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, Minus } from "lucide-react";

const KEY = "oc-course-promo-min";
/** Bump to re-open the banner for everyone who minimised it. */
const VERSION = "2026-10-16b";

/**
 * The course banner (the owner, 16/10, round three): narrower, never covers
 * content, can be minimised but not closed. Wide screens: a slim standing
 * banner docked at the free end-side; minimised = a small pill there. Narrow
 * screens: a ribbon at the top of the content; minimised = one line.
 * Animation: the hand-drawn arrow draws itself once, then the button breathes
 * with a soft glow ring - no bouncing (it fought the request widget's arrow).
 */
export function CoursePromoStrip({ show }: { show: boolean }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [min, setMin] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      // Not on the judging desk (the owner, 26/10 night: "בדף הזה שלא יראו את פרסומת הקורס") - it is back on every other page.
      if (!show || pathname.startsWith("/annual-course") || pathname.startsWith("/judge")) return setVisible(false);
      setVisible(true);
      try {
        setMin(localStorage.getItem(KEY) === VERSION);
      } catch {
        setMin(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [show, pathname]);
  if (!visible) return null;
  const remember = (m: boolean) => {
    try {
      if (m) localStorage.setItem(KEY, VERSION);
      else localStorage.removeItem(KEY);
    } catch {}
    setMin(m);
  };
  return (
    <>
      <style>{`
        @keyframes oc-draw { to { stroke-dashoffset: 0; } }
        @keyframes oc-breathe { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.55); } 60% { box-shadow: 0 0 0 10px rgba(255,255,255,0); } }
        .oc-draw { stroke-dasharray: 140; stroke-dashoffset: 140; animation: oc-draw 1.4s ease-out .5s forwards; }
        .oc-draw-head { stroke-dasharray: 40; stroke-dashoffset: 40; animation: oc-draw .5s ease-out 1.7s forwards; }
        .oc-breathe { animation: oc-breathe 2.6s ease-in-out 2.2s infinite; }
        @media (prefers-reduced-motion: reduce) { .oc-draw, .oc-draw-head { stroke-dashoffset: 0; animation: none; } .oc-breathe { animation: none; } }
      `}</style>

      {/* ── wide screens: the standing banner, or its pill ── */}
      {min ? (
        <button
          type="button"
          onClick={() => remember(false)}
          aria-label="פתיחת הבאנר של הקורס"
          className="hidden 2xl:flex fixed end-4 top-28 z-30 items-center gap-2 rounded-full bg-brand-gradient text-white shadow-glow-pink px-3.5 py-2 text-[12.5px] font-bold hover:opacity-95"
          dir="rtl"
        >
          🎓 קורס מאסטרית · 90% מימון <ChevronDown size={14} />
        </button>
      ) : (
        <aside
          aria-label="קורס מאסטרית בהייטק"
          dir="rtl"
          className="hidden 2xl:flex fixed end-4 top-24 z-30 w-[204px] flex-col rounded-[22px] bg-brand-gradient text-white shadow-glow-pink px-4 pt-4 pb-4 overflow-hidden"
        >
          <span className="absolute -top-6 -end-5 text-[120px] opacity-10 select-none" aria-hidden>
            🚀
          </span>
          <button
            type="button"
            onClick={() => remember(true)}
            aria-label="הקטנת הבאנר"
            title="להקטין"
            className="absolute top-2.5 start-2.5 h-6 w-6 inline-flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/35"
          >
            <Minus size={13} />
          </button>
          <div className="relative mt-5 inline-flex w-fit items-center gap-1 rounded-full bg-white text-brand-pink-deep text-[11px] font-black px-2 py-0.5">
            ⏳ הרישום עומד להסתיים
          </div>
          <h3 className="relative font-display text-[17px] font-black leading-tight mt-2.5">קורס מאסטרית בהייטק פתוח לרישום!</h3>
          <div className="relative mt-2 flex items-baseline gap-1">
            <span className="font-display text-[36px] font-black leading-none">90%</span>
            <span className="font-display text-[15px] font-black">מימון</span>
          </div>
          <p className="relative text-[12px] leading-snug text-white/95 mt-1.5">למי שרוצה לקבל את מיומנויות ההייטק החדשות בצורה מעמיקה.</p>
          <p className="relative text-[11.5px] leading-snug text-white/85 mt-1.5 font-semibold">
            4 קורסים מובילים בקורס שנתי אחד
            <br />
            שנה שלמה, 4 שעות בשבוע בזום בערב
          </p>
          {/* the arrow draws itself down to the button */}
          <svg aria-hidden width="52" height="46" viewBox="0 0 52 46" fill="none" className="relative self-center mt-1 -mb-1">
            <path className="oc-draw" d="M38 4 C 48 12, 40 22, 30 18 C 20 14, 22 4, 30 8 C 40 14, 32 32, 20 38" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" fill="none" />
            <path className="oc-draw-head" d="M29 34 L19 40 L14 29" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <Link
            href="/annual-course"
            className="oc-breathe relative inline-flex items-center justify-center rounded-full bg-white text-brand-purple font-display font-bold text-[13.5px] py-2 px-3 shadow-sm hover:bg-tint-purple transition-colors"
          >
            לפרטים ולהרשמה ←
          </Link>
        </aside>
      )}

      {/* ── narrower screens: the ribbon, or its one-line version ── */}
      <section
        role="region"
        aria-label="קורס מאסטרית בהייטק"
        dir="rtl"
        className="2xl:hidden relative overflow-hidden rounded-[18px] bg-brand-gradient text-white shadow-glow-pink mb-5"
      >
        {min ? (
          <button type="button" onClick={() => remember(false)} className="w-full px-4 py-2 flex items-center gap-2 text-[13px] font-bold text-start">
            🎓 קורס מאסטרית בהייטק · 90% מימון · הרישום עומד להסתיים
            <span className="ms-auto inline-flex items-center gap-1 text-[12px] font-semibold text-white/90">
              לפרטים <ChevronDown size={14} />
            </span>
          </button>
        ) : (
          <div className="px-5 py-3.5 flex items-center gap-x-4 gap-y-2 flex-wrap">
            <span className="absolute -top-5 -start-3 text-[92px] opacity-10 select-none" aria-hidden>
              🚀
            </span>
            <div className="relative flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-white text-brand-pink-deep text-[11.5px] font-black px-2 py-0.5">⏳ הרישום עומד להסתיים</span>
                <span className="inline-flex items-center rounded-full bg-white/20 text-white text-[11.5px] font-black px-2 py-0.5">90% מימון</span>
              </div>
              <div className="font-display font-black text-[18px] leading-tight mt-1">קורס מאסטרית בהייטק פתוח לרישום!</div>
              <div className="text-[13px] text-white/95 font-semibold mt-0.5">
                למי שרוצה לקבל את מיומנויות ההייטק החדשות בצורה מעמיקה · 4 קורסים מובילים בקורס שנתי אחד · שנה שלמה, 4 שעות בשבוע בזום בערב
              </div>
            </div>
            <div className="relative flex items-center gap-2">
              <svg aria-hidden width="44" height="40" viewBox="0 0 44 40" fill="none" className="shrink-0 hidden sm:block">
                <path className="oc-draw" d="M6 6 C 2 16, 14 20, 18 12 C 22 4, 10 2, 10 10 C 10 22, 28 20, 34 30" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" fill="none" />
                <path className="oc-draw-head" d="M24 28 L35 36 L41 25" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <Link
                href="/annual-course"
                className="oc-breathe inline-flex items-center justify-center rounded-full bg-white text-brand-purple font-display font-bold text-[14px] py-2 px-4 shadow-sm hover:bg-tint-purple transition-colors whitespace-nowrap"
              >
                לפרטים ולהרשמה ←
              </Link>
              <button
                type="button"
                onClick={() => remember(true)}
                aria-label="הקטנת הבאנר"
                title="להקטין"
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/35"
              >
                <ChevronUp size={15} />
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
