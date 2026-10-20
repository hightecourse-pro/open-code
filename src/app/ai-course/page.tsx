import type { Metadata } from "next";
import Image from "next/image";
import localFont from "next/font/local";
import { Quiz } from "./quiz";
import { H, CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_HREF, contactMailto } from "./theme";

/*
  /ai-course - a PUBLIC Hightecourse-branded page (outside the community, no
  login): a short quiz that matches a developer to one of the two
  "Advanced GenAI & Agentic AI for Developers" tracks and hands her the right
  syllabus. Styled after the printed syllabus: white sheet, navy headlines,
  yellow accents, navy footer bar. Hightecourse colors, NOT Open Code's.
*/

// Same self-hosted Rubik as the masters-course pages (no build-time font fetch).
const rubik = localFont({ src: "./fonts/Rubik-Variable.ttf", weight: "300 900", display: "swap" });

export const metadata: Metadata = {
  title: "איזה מסלול AI מתאים לך? | הייטקורס",
  description:
    "שאלון קצר שעוזר לבחור בין שני המסלולים של קורס Advanced GenAI & Agentic AI for Developers - המסלול המתקדם מאוד או המסלול מהבסיס עם תרגול.",
};

export default function AiCoursePage() {
  return (
    <div dir="rtl" className={`${rubik.className} flex min-h-screen flex-col`} style={{ background: "#F6F8FA" }}>
      {/* Logo strip */}
      <header className="w-full bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-4">
          <Image
            src="/ai-course/hightecourse.png"
            alt="הייטקורס - לחשוב בגדול"
            width={230}
            height={67}
            priority
            style={{ height: "auto", width: "min(210px, 55vw)" }}
          />
        </div>
      </header>

      {/* Navy hero band, like the catalog cover */}
      <section className="w-full" style={{ background: H.navy }}>
        <div className="mx-auto max-w-3xl px-4 py-8 text-center sm:py-10">
          <p className="text-[13px] font-bold tracking-wide sm:text-[14px]" style={{ color: H.yellow }} dir="ltr">
            Advanced GenAI &amp; Agentic AI for Developers
          </p>
          <h1 className="mt-2 text-[30px] font-black leading-tight text-white sm:text-[36px]">
            איזה מסלול מתאים לך?
          </h1>
          <p className="mt-2 text-[15.5px]" style={{ color: "#C9D9E6" }}>
            שאלון קצר שיעזור לך לבחור נכון בין שני מסלולי קורס פיתוח ה-AI
          </p>
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-8 sm:py-10">
        <Quiz />
      </main>

      {/* Navy footer bar, exactly in the syllabus' spirit */}
      <footer className="w-full" style={{ background: H.navy }}>
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-4 text-[13.5px] text-white">
          <span className="font-bold" style={{ color: H.yellow }}>
            הייטקורס. להתמקצע מהטובים ביותר
          </span>
          <span aria-hidden>|</span>
          <a href={CONTACT_PHONE_HREF} className="hover:underline" dir="ltr">
            {CONTACT_PHONE}
          </a>
          <span aria-hidden>|</span>
          <a href={contactMailto} className="hover:underline" dir="ltr">
            {CONTACT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}
