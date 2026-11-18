import type { Metadata } from "next";
import { rubik } from "@/app/ai-course/font";
import { CONFERENCE_SUBTITLE, CONFERENCE_TITLE, DAY, PATHS } from "@/lib/conference-shared";
import { Landing } from "./landing";

/*
  /hightecourse-2026 - a PUBLIC Hightecourse page (outside the community, no
  login): the marketing page of the conference's third day, Thursday
  26.11.2026 (the owner, 17/11: ״דף מגניב עם אנימציות שזזות בגלילה… מטרת הדף
  היא רישום לכנס ליום השלישי״). Hightecourse colors - navy, yellow, white - and
  the brochure's wording; ״הרשמי עכשיו״ leads to the registration form.
*/
const TITLE = `${CONFERENCE_TITLE} · ${CONFERENCE_SUBTITLE} | ${DAY.label} ${DAY.date}`;
const DESCRIPTION = `היום השלישי של הייטקורס 2026 - ${DAY.label}, ${DAY.date}, ${DAY.hebrew}: משחק קבוצתי, נירית כהן על עולם העבודה העתידי, מונודרמה סטירית, הגרלות, חלוקת תעודות ומופע שכולו עונג שבת. הרשמי עכשיו.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  icons: { icon: "/ai-course/icon.png", apple: "/ai-course/icon.png" },
  other: { google: "notranslate" },
  alternates: { canonical: PATHS.landing },
  openGraph: {
    type: "website",
    siteName: "הייטקורס",
    locale: "he_IL",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/hightecourse-2026/og.png", width: 1200, height: 630, alt: "הייטקורס 2026 - פוגשת אווירה חדשה - יום חמישי 26.11.2026" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/hightecourse-2026/og.png"] },
};

export default function ConferenceLandingPage() {
  return (
    <div dir="rtl" translate="no" className={`${rubik.className} notranslate`}>
      <Landing />
    </div>
  );
}
