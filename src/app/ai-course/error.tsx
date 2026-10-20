"use client";

import { useEffect } from "react";
import { H, CONTACT_EMAIL, contactMailto } from "./theme";

/*
  Last-resort error boundary for /ai-course, in Hightecourse style and Hebrew,
  instead of Next's English "This page couldn't load" (the owner, 20/10).
  The quiz keeps its progress in sessionStorage, so "להמשיך" or a reload
  brings her back to the step she was on. The error itself is reported to
  /api/ai-course/report (the admin shows it) and its gist is printed small
  at the bottom, so a screenshot is enough to understand what happened.
*/
export default function AiCourseError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      let step: string | null = null;
      let subId: string | null = null;
      try {
        const raw = sessionStorage.getItem("hightecourse-ai-quiz-v2");
        if (raw) {
          const s = JSON.parse(raw) as { step?: string; qIndex?: number; subId?: string | null };
          step = `${s.step ?? "?"}${typeof s.qIndex === "number" ? `#${s.qIndex + 1}` : ""}`;
          subId = s.subId ?? null;
        }
      } catch {
        /* no storage */
      }
      const body = JSON.stringify({ kind: "boundary", step, subId, message: `${error?.name ?? "Error"}: ${error?.message ?? ""}`, digest: error?.digest ?? null, stack: error?.stack ?? null, href: location.href });
      fetch("/api/ai-course/report", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch {
      /* reporting must never fail the fallback itself */
    }
  }, [error]);

  const gist = `${error?.name ?? "Error"}: ${(error?.message ?? "").slice(0, 160)}${error?.digest ? ` (${error.digest})` : ""}`;

  return (
    <div dir="rtl" translate="no" className="flex min-h-screen flex-col items-center justify-center px-4 py-10" style={{ background: H.bg }}>
      <div className="w-full max-w-md bg-white p-7 text-center sm:p-9" style={{ border: `1px solid ${H.line}`, borderRadius: 12 }}>
        <h1 className="text-[22px] font-black" style={{ color: H.navy }}>
          משהו השתבש לרגע
        </h1>
        <span className="mx-auto mt-2 block h-[4px] w-16" style={{ background: H.yellow, borderRadius: 2 }} />
        <p className="mt-4 text-[15px] leading-relaxed" style={{ color: H.ink }}>
          ההתקדמות שלך בשאלון נשמרה. לחצי כדי להמשיך מאותו מקום.
        </p>
        <button type="button" onClick={() => reset()} className="mt-6 w-full px-6 py-3.5 text-[16px] font-bold text-white transition-opacity hover:opacity-90" style={{ background: H.navy, borderRadius: 10 }}>
          להמשיך בשאלון
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2.5 w-full px-6 py-3 text-[15px] font-bold transition-colors"
          style={{ border: `2px solid ${H.navy}`, color: H.navy, background: H.white, borderRadius: 10 }}
        >
          לטעון את העמוד מחדש
        </button>
        <p className="mt-5 text-[13.5px]" style={{ color: H.muted }}>
          עדיין לא עובד? כתבי לנו:{" "}
          <a href={contactMailto} className="font-bold underline" dir="ltr" style={{ color: H.navy }}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-4 break-all text-[11px] leading-snug" style={{ color: "#9AA8B5" }} dir="ltr" data-testid="error-gist">
          {gist}
        </p>
      </div>
    </div>
  );
}
