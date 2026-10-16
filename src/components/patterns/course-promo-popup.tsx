"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

const KEY = "oc-course-promo-dismissed";
/** Bump to show the banner again to everyone who closed the previous one. */
const VERSION = "2026-10-16";

/**
 * The course banner (the owner, 16/10: "הייתי עושה באנר עומד, החץ מפנה
 * לכפתור, שיהיה ברור שהרישום עומד להסתיים, וזה 90% מימון, למי שרוצה לקבל
 * את מיומנויות ההייטק החדשות בצורה מעמיקה").
 *
 * Wide screens (2xl+): a standing banner docked at the free end-side of the
 * viewport - it covers nothing. Narrower screens: a ribbon at the top of the
 * content, in the flow. Both share one "closed" memory per browser.
 */
export function CoursePromoStrip({ show }: { show: boolean }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!show || pathname.startsWith("/annual-course")) return setVisible(false);
      try {
        setVisible(localStorage.getItem(KEY) !== VERSION);
      } catch {
        setVisible(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [show, pathname]);
  if (!visible) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, VERSION);
    } catch {}
    setVisible(false);
  };
  return (
    <>
      {/* ── the standing banner (wide screens) ── */}
      <aside
        aria-label="קורס מאסטרית בהייטק"
        dir="rtl"
        className="hidden 2xl:flex fixed end-6 top-24 z-30 w-[256px] flex-col rounded-[26px] bg-brand-gradient text-white shadow-glow-pink px-5 pt-5 pb-5 overflow-hidden"
      >
        <span className="absolute -top-8 -end-6 text-[150px] opacity-10 select-none" aria-hidden>
          🚀
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="סגירה"
          className="absolute top-3 start-3 h-7 w-7 inline-flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/35"
        >
          <X size={14} />
        </button>
        <div className="relative mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white text-brand-pink-deep text-[12px] font-black px-2.5 py-0.5">
          ⏳ הרישום עומד להסתיים
        </div>
        <h3 className="relative font-display text-[21px] font-black leading-tight mt-3">קורס מאסטרית בהייטק פתוח לרישום!</h3>
        <div className="relative mt-3 flex items-baseline gap-1.5">
          <span className="font-display text-[44px] font-black leading-none">90%</span>
          <span className="font-display text-[18px] font-black">מימון</span>
        </div>
        <p className="relative text-[13px] leading-snug text-white/95 mt-2">
          למי שרוצה לקבל את מיומנויות ההייטק החדשות בצורה מעמיקה.
        </p>
        <p className="relative text-[12.5px] leading-snug text-white/85 mt-2 font-semibold">
          4 קורסים מובילים בקורס שנתי אחד
          <br />
          שנה שלמה, 4 שעות בשבוע בזום בערב
        </p>
        {/* the hand-drawn arrow curls down to the button */}
        <svg aria-hidden width="60" height="54" viewBox="0 0 60 54" fill="none" className="relative self-center animate-bounce mt-1">
          <path d="M44 4 C 56 14, 46 24, 34 20 C 22 16, 24 4, 34 8 C 46 14, 36 36, 24 44" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" fill="none" />
          <path d="M34 40 L23 46 L18 34" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <Link
          href="/annual-course"
          onClick={dismiss}
          className="relative inline-flex items-center justify-center rounded-full bg-white text-brand-purple font-display font-bold text-[14.5px] py-2.5 px-4 shadow-sm hover:bg-tint-purple transition-colors"
        >
          לפרטים ולהרשמה ←
        </Link>
      </aside>

      {/* ── the ribbon (everything narrower than 2xl) ── */}
      <section
        role="region"
        aria-label="קורס מאסטרית בהייטק"
        dir="rtl"
        className="2xl:hidden relative overflow-hidden rounded-[18px] bg-brand-gradient text-white shadow-glow-pink mb-5 px-5 py-3.5 flex items-center gap-x-4 gap-y-2 flex-wrap"
      >
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
          <svg aria-hidden width="44" height="40" viewBox="0 0 44 40" fill="none" className="shrink-0 animate-bounce hidden sm:block">
            <path d="M6 6 C 2 16, 14 20, 18 12 C 22 4, 10 2, 10 10 C 10 22, 28 20, 34 30" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" fill="none" />
            <path d="M24 28 L35 36 L41 25" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <Link
            href="/annual-course"
            onClick={dismiss}
            className="inline-flex items-center justify-center rounded-full bg-white text-brand-purple font-display font-bold text-[14px] py-2 px-4 shadow-sm hover:bg-tint-purple transition-colors whitespace-nowrap"
          >
            לפרטים ולהרשמה ←
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="סגירה"
            className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/35"
          >
            <X size={15} />
          </button>
        </div>
      </section>
    </>
  );
}
