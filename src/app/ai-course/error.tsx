"use client";

import { H, CONTACT_PHONE, CONTACT_PHONE_HREF } from "./theme";

/*
  Last-resort error boundary for /ai-course, in Hightecourse style and Hebrew,
  instead of Next's English "This page couldn't load" (the owner, 20/10).
  The quiz keeps its progress in sessionStorage, so "להמשיך" or a reload
  brings her back to the step she was on.
*/
export default function AiCourseError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center px-4 py-10" style={{ background: H.bg }}>
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
          עדיין לא עובד? דברי איתנו:{" "}
          <a href={CONTACT_PHONE_HREF} className="font-bold underline" dir="ltr" style={{ color: H.navy }}>
            {CONTACT_PHONE}
          </a>
        </p>
      </div>
    </div>
  );
}
