"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

const KEY = "oc-course-promo-dismissed";
/** Bump to show the card again to everyone who closed the previous one. */
const VERSION = "2026-10-15";

/**
 * The floating course card (the owner, 15/10): "משהו מגניב חיצוני צף (עם X)
 * שמציע להצטרף לקורס, עם נקודות ברורות". Shown to job-seeking members who
 * are not registered yet; closing it (or going to the page) remembers the
 * choice per browser until the next version.
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
      className="fixed z-40 bottom-20 inset-x-4 md:inset-x-auto md:bottom-auto md:top-4 md:end-4 md:w-[340px]"
      dir="rtl"
      role="dialog"
      aria-label="הקורס השנתי הממומן"
    >
      <div className="rounded-[22px] p-[2px] bg-brand-gradient shadow-glow-pink">
        <div className="relative rounded-[20px] bg-white px-5 pt-5 pb-4">
          <button
            type="button"
            onClick={dismiss}
            aria-label="סגירה"
            className="absolute top-2.5 end-2.5 h-7 w-7 inline-flex items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-800"
          >
            <X size={15} />
          </button>
          <span className="font-mono text-[11px] text-brand-pink-deep">&lt;קורס שנתי/&gt;</span>
          <h3 className="font-display text-[19px] font-black text-ink-1000 mt-1 leading-tight">הקורס השנתי נפתח 🚀</h3>
          <ul className="mt-3 flex flex-col gap-1.5 text-[13.5px] text-ink-800">
            <li className="flex items-center gap-2"><span>💸</span><b>קורס ממומן</b></li>
            <li className="flex items-center gap-2"><span>🎓</span><b>תעודת טכנאי מה״ט</b></li>
            <li className="flex items-center gap-2"><span>📚</span><span><b>4 קורסים מובילים</b> בקורס אחד</span></li>
            <li className="flex items-center gap-2"><span>⚡</span><b className="text-brand-pink-deep">הקודמת זוכה!</b></li>
          </ul>
          <Link
            href="/annual-course"
            onClick={dismiss}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-brand-gradient text-white font-display font-bold text-[14px] py-2.5 hover:opacity-95 transition-opacity"
          >
            לפרטים ולהרשמה ←
          </Link>
          <button type="button" onClick={dismiss} className="mt-2 w-full text-[12px] text-ink-500 hover:text-ink-800">
            אולי אחר כך
          </button>
        </div>
      </div>
    </div>
  );
}
