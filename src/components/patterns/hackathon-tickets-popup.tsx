"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

/** The finals evening - the popup runs through that day and then disappears by itself. */
const UNTIL = "2026-10-28T23:59:59+02:00";
const TICKETS_URL = "https://glatticket.co.il/114929";

/**
 * The finals-tickets popup (the owner, 27/10): after she signed in, on every
 * load of the member area - a refresh included - and never again while she
 * moves between pages. A round white card with a pink frame and the
 * hackathon's logo, a floating X. Subscribers get the two-tickets offer.
 * Not on the judging desk.
 */
export function HackathonTicketsPopup({ subscriber }: { subscriber: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const decided = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  // once per mount: the first page decides; a client-side move to another page never re-opens it
  useEffect(() => {
    if (decided.current || !pathname) return;
    if (/^\/judge(\/|$)/.test(pathname)) return;
    decided.current = true;
    if (Date.now() > Date.parse(UNTIL)) return;
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-5 oc-tp-backdrop" dir="rtl" onClick={close} data-testid="tickets-popup">
      <style>{`
        @keyframes oc-tp-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes oc-tp-pop { 0% { opacity: 0; transform: scale(.72) } 100% { opacity: 1; transform: none } }
        @keyframes oc-tp-ring { 0%,100% { box-shadow: 0 18px 50px rgba(224,65,141,.22), 0 0 0 0 rgba(224,65,141,.35) } 55% { box-shadow: 0 18px 50px rgba(224,65,141,.22), 0 0 0 18px rgba(224,65,141,0) } }
        @keyframes oc-tp-hover { 0%,100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(-9px) rotate(8deg) } }
        @keyframes oc-tp-nudge { 0%,100% { transform: translateX(0) } 50% { transform: translateX(-4px) } }
        @keyframes oc-tp-logo-in { 0% { opacity: 0; transform: translateY(14px) scale(.6) rotate(-6deg) } 70% { opacity: 1; transform: translateY(-4px) scale(1.06) rotate(2deg) } 100% { opacity: 1; transform: none } }
        @keyframes oc-tp-logo { 0%,52%,100% { transform: translateY(0) rotate(0) scale(1) } 8% { transform: translateY(-22px) rotate(-9deg) scale(1.12) } 18% { transform: translateY(0) rotate(7deg) scale(.95) } 28% { transform: translateY(-13px) rotate(-6deg) scale(1.08) } 38% { transform: translateY(0) rotate(4deg) scale(.98) } 46% { transform: translateY(-5px) rotate(-2deg) scale(1.02) } }
        .oc-tp-backdrop { background: rgba(31, 30, 63, .5); backdrop-filter: blur(3px); animation: oc-tp-fade .35s ease-out both }
        .oc-tp-card { animation: oc-tp-pop .75s cubic-bezier(.34,1.56,.64,1) .05s both, oc-tp-ring 2.8s ease-in-out 1s infinite }
        .oc-tp-x { animation: oc-tp-hover 2.6s ease-in-out .9s infinite }
        .oc-tp-arrow { display: inline-block; animation: oc-tp-nudge 1.4s ease-in-out 1.2s infinite }
        .oc-tp-logo { animation: oc-tp-logo-in .9s cubic-bezier(.34,1.56,.64,1) .25s both, oc-tp-logo 3.2s ease-in-out 1.3s infinite; transform-origin: 50% 70% }
        @media (prefers-reduced-motion: reduce) { .oc-tp-backdrop, .oc-tp-card, .oc-tp-x, .oc-tp-arrow, .oc-tp-logo { animation: none } }
      `}</style>
      <div className="relative" onClick={(e) => e.stopPropagation()} style={{ width: "min(92vw, 470px)" }}>
        {/* the floating X - outside the circle's edge */}
        <button
          type="button"
          onClick={close}
          aria-label="סגירה"
          title="סגירה"
          className="oc-tp-x absolute -top-2 start-2 sm:-top-1 sm:-start-1 z-10 h-12 w-12 inline-flex items-center justify-center rounded-full bg-white text-brand-pink-deep border-[3px] border-brand-pink shadow-[0_8px_20px_rgba(224,65,141,.28)] hover:bg-tint-pink transition-colors"
        >
          <X size={22} strokeWidth={2.6} />
        </button>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="oc-tp-title"
          className="oc-tp-card flex flex-col items-center justify-center text-center rounded-full bg-white border-[4px] border-brand-pink"
          style={{ aspectRatio: "1 / 1", padding: "clamp(28px, 9vw, 54px) clamp(34px, 11vw, 62px)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/live/hackathon-color.png" alt="האקתון AI 2026" className="oc-tp-logo w-auto select-none" style={{ height: "clamp(64px, 20vw, 108px)" }} draggable={false} />
          <h2 id="oc-tp-title" className="font-display font-black text-ink-900 leading-tight mt-2" style={{ fontSize: "clamp(21px, 6vw, 29px)" }}>
            כבר קנית כרטיס לגמר?
          </h2>
          {subscriber ? (
            <p className="text-ink-700 font-semibold leading-snug mt-2" style={{ fontSize: "clamp(12.5px, 3.6vw, 14.5px)" }}>
              <span className="font-display font-bold text-brand-pink-deep">רוצה להגיע עם חברה?</span>
              <br />2 כרטיסים במחיר מוזל של 20 ש״ח בהקשת מספר הטלפון שלך בקהילה.
            </p>
          ) : (
            <p className="text-ink-700 font-semibold leading-snug mt-2" style={{ fontSize: "clamp(12.5px, 3.6vw, 14.5px)" }}>
              יום רביעי 28/10 · היכל התרבות רמות, ירושלים
            </p>
          )}
          <a
            href={TICKETS_URL}
            target="_blank"
            rel="noreferrer"
            onClick={close}
            className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-pink text-white font-display font-bold py-2.5 px-6 shadow-[0_6px_16px_rgba(224,65,141,.35)] hover:bg-brand-pink-deep transition-colors whitespace-nowrap"
            style={{ fontSize: "clamp(14px, 4vw, 16px)" }}
          >
            לרכישת כרטיס <span className="oc-tp-arrow">←</span>
          </a>
          <button type="button" onClick={close} className="mt-2 text-[12px] text-ink-500 hover:text-ink-900 underline-offset-2 hover:underline">
            לא עכשיו
          </button>
        </div>
      </div>
    </div>
  );
}
