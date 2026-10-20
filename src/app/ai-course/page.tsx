import type { Metadata } from "next";
import { Brand, PageFooter } from "./chrome";
import { rubik } from "./font";
import { Quiz } from "./quiz";
import { COURSE_TITLE } from "./questions";
import { H } from "./theme";

/*
  /ai-course - a PUBLIC Hightecourse-branded page (outside the community, no
  login): a short quiz that matches a registrant to one of the two
  "Advanced GenAI & Agentic AI for Developers" tracks and hands her the right
  syllabus. Styled after the printed syllabus: white sheet, navy headlines,
  yellow accents, navy footer bar. Hightecourse colors, NOT Open Code's.
*/

const TITLE = "איזה מסלול AI מתאים לך? | הייטקורס";
const DESCRIPTION =
  "שאלון קצר שעוזר לבחור בין שני המסלולים של קורס Advanced GenAI & Agentic AI for Developers - המסלול המתקדם מאוד או המסלול מהבסיס עם תרגול.";

// Its own title and share card - the root layout's template and OG image
// belong to the community, and this page is Hightecourse's. "notranslate":
// a browser that auto-translates rewrites the DOM under React (20/10).
export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  icons: { icon: "/ai-course/icon.png", apple: "/ai-course/icon.png" },
  other: { google: "notranslate" },
  openGraph: {
    type: "website",
    siteName: "הייטקורס",
    locale: "he_IL",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/ai-course/og.png", width: 1200, height: 630, alt: "הייטקורס - לחשוב בגדול" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/ai-course/og.png"] },
};

export default function AiCoursePage() {
  return (
    <div dir="rtl" translate="no" className={`${rubik.className} notranslate flex min-h-screen flex-col`} style={{ background: H.bg, color: H.ink }}>
      <Brand />

      {/* Navy hero band, like the catalog cover */}
      <section className="w-full" style={{ background: H.navy }}>
        <div className="mx-auto max-w-3xl px-4 py-8 text-center sm:py-10">
          <p className="text-[13px] font-bold tracking-wide sm:text-[14px]" style={{ color: H.yellow }} dir="ltr">
            {COURSE_TITLE}
          </p>
          <h1 className="mt-2 text-[30px] font-black leading-tight text-white sm:text-[36px]">איזה מסלול מתאים לך?</h1>
          <p className="mt-2 text-[15.5px]" style={{ color: "#C9D9E6" }}>
            שאלון קצר שיעזור לך לבחור נכון בין שני מסלולי הקורס
          </p>
        </div>
      </section>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-8 sm:py-10">
        <Quiz />
      </main>

      <PageFooter />
    </div>
  );
}
