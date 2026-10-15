"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

const KEY = "oc-course-promo-dismissed";
/** Bump to show the strip again to everyone who closed the previous one. */
const VERSION = "2026-10-15c";

/**
 * The course strip (the owner, 15/10, after the floating blob "לא יצאה יפה
 * והיא מסתירה"): a gradient ribbon that sits at the top of the page content,
 * in the flow - it pushes the page down a little instead of covering it.
 * Hand-drawn curly arrow to the button, the headline and the two lines only,
 * X to close (remembered per browser until the next version).
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
    <section
      role="region"
      aria-label="קורס מאסטרית בהייטק"
      dir="rtl"
      className="relative overflow-hidden rounded-[18px] bg-brand-gradient text-white shadow-glow-pink mb-5 px-5 py-3.5 flex items-center gap-x-4 gap-y-2 flex-wrap"
    >
      <span className="absolute -top-5 -start-3 text-[92px] opacity-10 select-none" aria-hidden>
        🚀
      </span>
      <div className="relative flex-1 min-w-[240px]">
        <div className="font-display font-black text-[18px] leading-tight">קורס מאסטרית בהייטק פתוח לרישום!</div>
        <div className="text-[13px] text-white/95 font-semibold mt-0.5">
          4 קורסים מובילים בקורס שנתי אחד · שנה שלמה, 4 שעות בשבוע בזום בערב
        </div>
      </div>
      <div className="relative flex items-center gap-2">
        {/* The hand-drawn curly arrow (same hand as the request widget's), pointing at the button. */}
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
  );
}
