import type { Metadata } from "next";
import Image from "next/image";
import localFont from "next/font/local";
import { Quiz } from "./quiz";
import { H, CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_HREF, contactMailto } from "./theme";

/*
  /ai-course - a PUBLIC Hightecourse-branded page (outside the community, no
  login): a short friendly quiz that matches a developer to one of the two
  "Advanced GenAI & Agentic AI for Developers" tracks and hands her the right
  syllabus. Follows the masters-course public-page pattern; Hightecourse
  colors (navy #004878 / yellow #F8C800 from the logo), NOT Open Code's.
*/

// Same self-hosted Rubik as the masters-course pages (no build-time font fetch).
const rubik = localFont({ src: "./fonts/Rubik-Variable.ttf", weight: "300 900", display: "swap" });

export const metadata: Metadata = {
  title: "איזה מסלול AI מתאים לך? | הייטקורס",
  description:
    "שאלון קצר וידידותי שעוזר לבחור בין שני המסלולים של קורס Advanced GenAI & Agentic AI for Developers - המסלול המתקדם מאוד או המסלול מהבסיס עם תרגול.",
};

export default function AiCoursePage() {
  return (
    <div dir="rtl" className={`${rubik.className} min-h-screen`} style={{ background: H.bg }}>
      {/* Top brand bar */}
      <header className="w-full" style={{ background: H.white, borderBottom: `3px solid ${H.yellow}` }}>
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-4">
          <Image
            src="/ai-course/hightecourse.png"
            alt="הייטקורס - לחשוב בגדול"
            width={260}
            height={76}
            priority
            style={{ height: "auto", width: "min(240px, 60vw)" }}
          />
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-8 sm:py-12">
        <Quiz />
      </main>

      <footer className="pb-10 text-center text-[14px]" style={{ color: H.muted }}>
        <p>
          הייטקורס · להתמקצע מהטובים ביותר ·{" "}
          <a href={CONTACT_PHONE_HREF} className="underline" dir="ltr">
            {CONTACT_PHONE}
          </a>{" "}
          ·{" "}
          <a href={contactMailto} className="underline" dir="ltr">
            {CONTACT_EMAIL}
          </a>
        </p>
      </footer>
    </div>
  );
}
