"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

/** The finals evening - the popup runs through that day and then disappears by itself. */
const UNTIL = "2026-10-28T23:59:59+02:00";
const TICKETS_URL = "https://glatticket.co.il/114929";
const KEY = "oc-finals-tickets-2026";

/**
 * The finals-tickets popup (the owner, 27/10): "פרסומת קופצת בכל כניסה לאתר
 * שתקפוץ עד תאריך ההאקתון" - once per entry to the site (a browser session),
 * never again while she moves between pages; closed with an X. Subscribers
 * get the two-tickets offer on top. Not on the hall screen, the judges' pages,
 * the admin, the employer portal or the course tracks.
 */
export function HackathonTicketsPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [subscriber, setSubscriber] = useState(false);
  const decided = useRef(false);

  const close = useCallback(() => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {}
    setOpen(false);
  }, []);

  // once per entry: the first page decides, later navigations never re-open it
  useEffect(() => {
    if (decided.current || !pathname) return;
    // not where it would be in the way: the hall screen and the judges, the admin, the employers, the
    // coordinators, the course tracks, and the sign-in pages - a member who lands on /login gets it on
    // her first page inside
    if (/^\/(live|judge|admin|portal|coordinator|dev|auth|api|ai-course|masters-course|login|signup|register|forgot|reset)(\/|$|-)/.test(pathname)) return;
    decided.current = true;
    if (Date.now() > Date.parse(UNTIL)) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
    } catch {}
    if (seen) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/hackathon/tickets-offer", { cache: "no-store" });
        const j = (await r.json().catch(() => null)) as { subscriber?: boolean } | null;
        if (alive) setSubscriber(!!j?.subscriber);
      } catch {}
      if (alive) setOpen(true);
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 oc-tp-backdrop" dir="rtl" onClick={close} data-testid="tickets-popup">
      <style>{`
        @keyframes oc-tp-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes oc-tp-pop { 0% { opacity: 0; transform: translateY(28px) scale(.9) rotate(-1.5deg) } 60% { opacity: 1 } 100% { opacity: 1; transform: none } }
        @keyframes oc-tp-float { 0%,100% { transform: translateY(0) rotate(-8deg) } 50% { transform: translateY(-10px) rotate(6deg) } }
        @keyframes oc-tp-shine { from { background-position: 200% 0 } to { background-position: -200% 0 } }
        @keyframes oc-tp-breathe { 0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,.55) } 60% { box-shadow: 0 0 0 12px rgba(255,255,255,0) } }
        @keyframes oc-tp-wiggle { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-10deg) } 75% { transform: rotate(10deg) } }
        .oc-tp-backdrop { background: rgba(21, 18, 58, .55); backdrop-filter: blur(4px); animation: oc-tp-fade .35s ease-out both }
        .oc-tp-card { animation: oc-tp-pop .7s cubic-bezier(.34,1.56,.64,1) .05s both }
        .oc-tp-ticket { animation: oc-tp-float 3.2s ease-in-out infinite }
        .oc-tp-shine { background-image: linear-gradient(110deg, transparent 35%, rgba(255,255,255,.22) 50%, transparent 65%); background-size: 200% 100%; animation: oc-tp-shine 3.4s linear 1s infinite }
        .oc-tp-breathe { animation: oc-tp-breathe 2.4s ease-in-out 1.2s infinite }
        .oc-tp-wiggle { display: inline-block; animation: oc-tp-wiggle 1.6s ease-in-out .8s 3 }
        @media (prefers-reduced-motion: reduce) { .oc-tp-backdrop, .oc-tp-card, .oc-tp-ticket, .oc-tp-shine, .oc-tp-breathe, .oc-tp-wiggle { animation: none } }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="oc-tp-title"
        onClick={(e) => e.stopPropagation()}
        className="oc-tp-card relative w-full max-w-[460px] overflow-hidden rounded-[28px] bg-brand-gradient text-white shadow-glow-pink"
      >
        <span className="oc-tp-shine pointer-events-none absolute inset-0" aria-hidden />
        <span className="oc-tp-ticket pointer-events-none absolute -top-4 -start-3 text-[96px] opacity-25 select-none" aria-hidden>
          🎟️
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="סגירה"
          title="סגירה"
          className="absolute top-3 start-3 z-10 h-9 w-9 inline-flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/35 transition-colors"
        >
          <X size={18} />
        </button>
        <div className="relative px-7 pt-9 pb-7 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white text-brand-pink-deep text-[12px] font-black px-3 py-1">
            <span className="oc-tp-wiggle">🎤</span> ערב הגמר · יום רביעי 28/10 · היכל התרבות רמות, ירושלים
          </div>
          <h2 id="oc-tp-title" className="font-display font-black text-[30px] sm:text-[34px] leading-tight mt-4">
            כבר קנית כרטיס לגמר?
          </h2>
          {subscriber ? (
            <div className="mt-4 rounded-[18px] bg-white/15 border border-white/25 px-4 py-3 text-start">
              <div className="font-display font-black text-[18px] leading-tight">רוצה להגיע עם חברה? 💜</div>
              <p className="text-[14px] leading-snug text-white/95 mt-1 font-semibold">2 כרטיסים במחיר מוזל של 20 ש״ח בהקשת מספר הטלפון שלך בקהילה.</p>
            </div>
          ) : (
            <p className="text-[15px] leading-snug text-white/90 mt-3 font-semibold">הפתרונות עולות לבמה, הקהל מצביע בטלפון, והזוכות נחשפות על המסך. מקומך שמור?</p>
          )}
          <a
            href={TICKETS_URL}
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="oc-tp-breathe mt-5 inline-flex items-center justify-center rounded-full bg-white text-brand-purple font-display font-bold text-[16px] py-2.5 px-7 shadow-sm hover:bg-tint-purple transition-colors"
          >
            לרכישת כרטיס ←
          </a>
          <button type="button" onClick={close} className="block mx-auto mt-3 text-[12.5px] text-white/75 hover:text-white underline-offset-2 hover:underline">
            לא עכשיו
          </button>
        </div>
      </div>
    </div>
  );
}
