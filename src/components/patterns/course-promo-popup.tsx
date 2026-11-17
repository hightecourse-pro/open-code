"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

/** Registration closes on Thursday 19.11 (the owner, 17/11: ״הרישום עד יום חמישי״) - the popup runs through that day and then disappears by itself. */
const UNTIL = "2026-11-19T23:59:59+02:00";
const REGISTER_HREF = "/masters-course/register";
const DETAILS_HREF = "/annual-course";
/** Counted like page views, as the finals popup was (״כמה ראו, מי לחצה״). */
const SHOWN_PATH = "/annual-course/popup";
const CTA_PATH = "/annual-course/popup/register";
const beacon = (path: string) => {
  try {
    fetch("/api/track", { method: "POST", body: JSON.stringify({ path, referrer: null, search: null }), headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {}
};
/** The three partners, as on the sales page. */
const LOGOS = [
  { src: "/masters-course/shufra.png", alt: "שופרא" },
  { src: "/masters-course/opencode.png", alt: "קוד פתוח" },
  { src: "/masters-course/hightcourse.png", alt: "הייטקורס" },
];
/** The course's own navy (masters-course/theme) - the title keeps the course's identity inside the community's pink frame. */
const NAVY = "#23405F";

/**
 * The course popup (the owner, 17/11: ״להוריד את הפרסום בצד… פרסום בעיגול כמו
 * שהיה להאקתון עם אנימציה מגניבה, הרישום עד יום חמישי״) - replaces the standing
 * banner. Like the finals popup: after sign-in, on every load of the member
 * area (a refresh included), never again while she moves between pages; a round
 * white card with the pink frame and a floating X. Here the three partner logos
 * drift in, the 90 counts up and pops, a dashed ring orbits the card, and the
 * deadline chip pulses. Same crowd as the banner had: job-seeking members who
 * have not registered, and the team. Not on the course pages or the judging desk.
 */
export function CoursePromoPopup({ show }: { show: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const decided = useRef(false);
  const xRef = useRef<HTMLButtonElement | null>(null);
  const numRef = useRef<HTMLSpanElement | null>(null);
  const logosRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // once per mount: the first page decides; a client-side move to another page never re-opens it
  useEffect(() => {
    if (decided.current || !pathname) return;
    if (/^\/judge(\/|$)/.test(pathname)) return;
    decided.current = true;
    // she is already reading about the course - no popup over it
    if (/^\/(annual-course|masters-course)(\/|$)/.test(pathname)) return;
    if (!show || Date.now() > Date.parse(UNTIL)) return;
    const t = setTimeout(() => {
      setOpen(true);
      beacon(SHOWN_PATH);
    }, 600);
    return () => clearTimeout(t);
  }, [pathname, show]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // The eye-catching motion runs through the Web Animations API (as in the finals popup), so it
  // moves even where the system turned CSS animations off - the owner's machine, by her screenshots.
  useEffect(() => {
    if (!open) return;
    const anims: Animation[] = [];
    const can = (el: Element | null | undefined): el is HTMLElement => !!el && typeof (el as HTMLElement).animate === "function";
    // the three partners drift in one after the other
    logosRef.current?.querySelectorAll("img").forEach((img, i) => {
      if (can(img)) {
        anims.push(
          img.animate([{ opacity: 0, transform: "translateY(10px) scale(.88)" }, { opacity: 1, transform: "none" }], {
            duration: 520,
            delay: 350 + i * 140,
            easing: "cubic-bezier(.34,1.56,.64,1)",
            fill: "both",
          })
        );
      }
    });
    // the 90 counts up from zero, then pops
    const num = numRef.current;
    let raf = 0;
    if (num) {
      const start = performance.now() + 450;
      const duration = 1300;
      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - start) / duration));
        const eased = 1 - Math.pow(1 - t, 3);
        num.textContent = String(Math.round(90 * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
        else if (can(num)) {
          anims.push(
            num.animate([{ transform: "scale(1)" }, { transform: "scale(1.22) rotate(-4deg)" }, { transform: "scale(1)" }], {
              duration: 560,
              easing: "cubic-bezier(.34,1.56,.64,1)",
            })
          );
        }
      };
      raf = requestAnimationFrame(tick);
    }
    const x = xRef.current;
    if (can(x)) {
      anims.push(
        x.animate([{ transform: "translateY(0) rotate(0deg)" }, { transform: "translateY(-9px) rotate(8deg)" }, { transform: "translateY(0) rotate(0deg)" }], {
          duration: 2600,
          iterations: Infinity,
          easing: "ease-in-out",
          delay: 900,
        })
      );
    }
    return () => {
      cancelAnimationFrame(raf);
      anims.forEach((a) => a.cancel());
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-5 oc-cp-backdrop" dir="rtl" onClick={close} data-testid="course-popup">
      <style>{`
        @keyframes oc-cp-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes oc-cp-pop { 0% { opacity: 0; transform: scale(.72) } 100% { opacity: 1; transform: none } }
        @keyframes oc-cp-ring { 0%,100% { box-shadow: 0 18px 50px rgba(224,65,141,.22), 0 0 0 0 rgba(224,65,141,.35) } 55% { box-shadow: 0 18px 50px rgba(224,65,141,.22), 0 0 0 18px rgba(224,65,141,0) } }
        @keyframes oc-cp-spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes oc-cp-nudge { 0%,100% { transform: translateX(0) } 50% { transform: translateX(-4px) } }
        @keyframes oc-cp-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(224,65,141,.45) } 60% { box-shadow: 0 0 0 8px rgba(224,65,141,0) } }
        .oc-cp-backdrop { background: rgba(31, 30, 63, .5); backdrop-filter: blur(3px); animation: oc-cp-fade .35s ease-out both }
        .oc-cp-card { animation: oc-cp-pop .75s cubic-bezier(.34,1.56,.64,1) .05s both, oc-cp-ring 2.8s ease-in-out 1s infinite }
        .oc-cp-orbit { animation: oc-cp-fade .6s ease-out .5s both, oc-cp-spin 26s linear infinite }
        .oc-cp-arrow { display: inline-block; animation: oc-cp-nudge 1.4s ease-in-out 1.2s infinite }
        .oc-cp-chip { animation: oc-cp-pulse 2.2s ease-in-out 2.2s infinite }
      `}</style>
      <div className="relative" onClick={(e) => e.stopPropagation()} style={{ width: "min(92vw, 470px)" }}>
        {/* the orbit - a dashed ring turning slowly around the card */}
        <div aria-hidden className="oc-cp-orbit pointer-events-none absolute -inset-3 rounded-full border-[3px] border-dashed" style={{ borderColor: "rgba(224,65,141,.45)" }} data-course-popup-orbit />
        {/* the floating X - outside the circle's edge */}
        <button
          type="button"
          onClick={close}
          aria-label="סגירה"
          title="סגירה"
          ref={xRef}
          className="absolute -top-2 start-2 sm:-top-1 sm:-start-1 z-10 h-12 w-12 inline-flex items-center justify-center rounded-full bg-white text-brand-pink-deep border-[3px] border-brand-pink shadow-[0_8px_20px_rgba(224,65,141,.28)] hover:bg-tint-pink transition-colors"
        >
          <X size={22} strokeWidth={2.6} />
        </button>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="oc-cp-title"
          className="oc-cp-card relative flex flex-col items-center justify-center text-center rounded-full bg-white border-[4px] border-brand-pink"
          style={{ aspectRatio: "1 / 1", padding: "clamp(30px, 9vw, 54px) clamp(34px, 11vw, 62px)" }}
        >
          <div ref={logosRef} className="flex items-center justify-center gap-3 sm:gap-4">
            {LOGOS.map((l) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={l.src} src={l.src} alt={l.alt} className="w-auto select-none" style={{ height: "clamp(16px, 4.6vw, 24px)" }} draggable={false} />
            ))}
          </div>
          <h2 id="oc-cp-title" className="font-display font-black leading-tight mt-2" style={{ color: NAVY, fontSize: "clamp(21px, 6vw, 29px)" }}>
            מאסטרית בהייטק
          </h2>
          <div className="flex items-baseline justify-center gap-1.5 mt-0.5">
            <span className="font-display font-black leading-none text-brand-pink-deep tabular-nums" style={{ fontSize: "clamp(42px, 12vw, 60px)" }}>
              <span ref={numRef} className="inline-block" data-course-popup-number>
                0
              </span>
              %
            </span>
            <span className="font-display font-black" style={{ color: NAVY, fontSize: "clamp(18px, 5vw, 24px)" }}>
              מימון
            </span>
          </div>
          <p className="text-ink-700 font-semibold leading-snug mt-1" style={{ fontSize: "clamp(12.5px, 3.6vw, 14.5px)" }}>
            4 קורסים מבוקשים בקורס שנתי אחד
            <br />
            12 × 125 ₪ למנויות קוד פתוח
          </p>
          <span className="oc-cp-chip inline-flex items-center rounded-full bg-tint-pink text-brand-pink-deep font-display font-bold px-3 py-1 mt-2" style={{ fontSize: "clamp(12px, 3.4vw, 13.5px)" }}>
            הרישום עד יום חמישי 19.11
          </span>
          <Link
            href={REGISTER_HREF}
            onClick={() => {
              beacon(CTA_PATH);
              close();
            }}
            className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-pink text-white font-display font-bold py-2.5 px-6 shadow-[0_6px_16px_rgba(224,65,141,.35)] hover:bg-brand-pink-deep transition-colors whitespace-nowrap"
            style={{ fontSize: "clamp(14px, 4vw, 16px)" }}
          >
            להרשמה עכשיו <span className="oc-cp-arrow">←</span>
          </Link>
          <div className="mt-2 flex items-center gap-2.5 text-[12px] text-ink-500">
            <Link href={DETAILS_HREF} onClick={close} className="hover:text-ink-900 underline-offset-2 hover:underline">
              לפרטים על הקורס
            </Link>
            <span aria-hidden>·</span>
            <button type="button" onClick={close} className="hover:text-ink-900 underline-offset-2 hover:underline">
              לא עכשיו
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
