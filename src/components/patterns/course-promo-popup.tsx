"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

const KEY = "oc-course-promo-dismissed";
/** Bump to show the card again to everyone who closed the previous one. */
const VERSION = "2026-10-15b";

/**
 * The floating course blob (the owner, 15/10): "משהו מגניב חיצוני צף (עם X)…
 * לא מרובע, עם חץ מסולסל, הטקסט רק מתזכר". A gradient blob with a hand-drawn
 * arrow to the button. Shown to job-seeking members who have not registered
 * (and to the team); closing it, or going to the page, is remembered per
 * browser until the next version.
 */
export function CoursePromoPopup({ show }: { show: boolean }) {
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
    }, 900);
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
    <div
      className="fixed z-40 bottom-20 inset-x-3 md:inset-x-auto md:bottom-auto md:top-3 md:end-3 md:w-[372px]"
      dir="rtl"
      role="dialog"
      aria-label="קורס מאסטרית בהייטק"
    >
      <div
        className="relative bg-brand-gradient text-white shadow-glow-pink px-8 pt-7 pb-6 md:-rotate-2"
        style={{ borderRadius: "62% 38% 56% 44% / 50% 46% 54% 50%" }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="סגירה"
          className="absolute top-6 end-9 h-7 w-7 inline-flex items-center justify-center rounded-full bg-white/25 text-white hover:bg-white/40"
        >
          <X size={15} />
        </button>
        <div className="md:rotate-2">
          <h3 className="font-display text-[21px] font-black leading-tight pe-6">קורס מאסטרית בהייטק פתוח לרישום!</h3>
          <p className="mt-2.5 text-[14px] leading-snug text-white/95 font-semibold">
            4 קורסים מובילים בקורס שנתי אחד
            <br />
            שנה שלמה, 4 שעות בשבוע בזום בערב
          </p>
          <div className="mt-3 flex items-end gap-2">
            {/* The hand-drawn curly arrow (same hand as the request widget's), pointing at the button. */}
            <svg aria-hidden width="52" height="54" viewBox="0 0 52 54" fill="none" className="shrink-0 animate-bounce -mb-1">
              <path d="M8 4 C 2 18, 18 22, 24 14 C 30 6, 14 2, 14 12 C 14 26, 36 24, 40 40" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M30 36 L41 46 L48 34" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <Link
              href="/annual-course"
              onClick={dismiss}
              className="flex-1 inline-flex items-center justify-center rounded-full bg-white text-brand-purple font-display font-bold text-[14.5px] py-2.5 px-4 shadow-sm hover:bg-tint-purple transition-colors"
            >
              לפרטים ולהרשמה ←
            </Link>
          </div>
          <button type="button" onClick={dismiss} className="mt-2.5 w-full text-[12px] text-white/80 hover:text-white">
            אולי אחר כך
          </button>
        </div>
      </div>
    </div>
  );
}
