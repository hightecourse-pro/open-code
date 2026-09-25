import type { Metadata } from "next";
import Link from "next/link";
import { C, CourseFooter, PartnersHeader, WA_URL, rubik } from "./shared";

export const metadata: Metadata = {
  title: "מאסטרית בהייטק - הקורס השנתי של שופרא, קוד פתוח והייטקורס",
  description:
    "4 קורסים מבוקשים בקורס שנתי מעמיק אחד, ב-90% מימון: פיתוח פתרונות AI, Vibe Coding, ניהול מוצר וארכיטקטורה למערכות מורכבות. 1,500 ₪ למנויות קוד פתוח.",
  openGraph: {
    title: "מאסטרית בהייטק - 4 קורסים מבוקשים ב-90% מימון",
    description: "קורס שנתי מעמיק אחד: AI, Vibe Coding, ניהול מוצר, ארכיטקטורה. 12 × 125 ₪ למנויות קוד פתוח.",
  },
};

// The four cards - the ad's own words, nothing added (the owner, 25/9:
// "בקוביות תשאיר את הטקסט כמו במודעה").
const COURSES = [
  { color: C.yellow, title: "פיתוח פתרונות AI מתקדמים", sub: "AI Agents, RAG, MCP - ברמת פרודקשן" },
  { color: C.teal, title: "ארכיטקטורה למערכות מורכבות", sub: "הבנה מערכתית טכנולוגית - כי כל מפתחת היום הופכת לארכיטקטית" },
  { color: C.orange, title: "Vibe Coding", sub: "פרקטיקה לבניית מערכות מקצה לקצה עם כלי AI - בשילוב אוטומציה עסקית" },
  { color: C.pink, title: "ניהול מוצר והבנה עסקית", sub: "הבנה עסקית רחבה - כי כל מפתחת היום הופכת למנהלת אייג׳נטים" },
];

// "גם … וגם …" - the lead word is the big one in every line.
const GETS: Array<[string, string, string, string]> = [
  [C.orange, "גם", "קורס Vibe Coding", "פיתוח מתקדם מקצה לקצה בכלי AI בשילוב אוטומציות."],
  [C.yellow, "גם", "קורס פיתוח AI", "לפיתוח פתרונות AI ואייג׳נטים כמו שעושים את זה בפרודקשן."],
  [C.pink, "גם", "קורס ניהול מוצר והבנה עסקית", "כי היום מפתחת צריכה לראות את התמונה השלמה."],
  [C.teal, "וגם", "קורס ארכיטקטורה", "החידוש של 2026! קורס שילמד אותך מהידיים הבנת ארכיטקטורה במערכות מורכבות."],
];

export default function MastersCoursePage() {
  return (
    <main dir="rtl" className={`${rubik.className} min-h-screen`} style={{ background: C.bg, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-5 py-8 sm:py-12 flex flex-col gap-8">
        <PartnersHeader />

        {/* Hero */}
        <section className="bg-white/70 rounded-[32px] px-6 py-9 sm:px-10 sm:py-12 text-center shadow-sm">
          <p className="text-[19px] sm:text-[24px]" style={{ color: C.navy }}>
            שופרא בשיתוף קוד פתוח והייטקורס
            <br />
            בקורס שיהפוך אותך
          </p>
          <h1 className="font-black text-[38px] sm:text-[52px] leading-tight mt-1" style={{ color: C.navy }}>
            למאסטרית בהייטק
          </h1>
          <div className="inline-block rounded-[22px] px-8 py-3 mt-6" style={{ background: C.teal }}>
            <span className="font-black text-[38px] sm:text-[56px] leading-none" style={{ color: C.navy }}>
              4 קורסים מבוקשים
            </span>
          </div>
          <p className="font-black text-[26px] sm:text-[34px] leading-tight mt-5" style={{ color: C.navy }}>
            בקורס שנתי מעמיק אחד
            <br />
            ב-90% מימון!
          </p>

          {/* Course cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-9">
            {COURSES.map((c) => (
              <article key={c.title} className="relative bg-white rounded-[24px] px-6 pt-8 pb-7 shadow-sm">
                <span
                  className="absolute -top-3 right-1/2 translate-x-1/2 w-6 h-6 rounded-full"
                  style={{ background: c.color }}
                  aria-hidden
                />
                <h2 className="font-black text-[24px] sm:text-[26px] leading-tight text-center" style={{ color: c.color }}>
                  {c.title}
                </h2>
                <p className="text-[15px] sm:text-[16px] text-center mt-3 font-medium leading-relaxed" style={{ color: C.navy }}>
                  {c.sub}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* What you get */}
        <section className="bg-white rounded-[32px] px-6 py-8 sm:px-10 shadow-sm">
          <h2 className="font-black text-[28px] sm:text-[34px] text-center" style={{ color: C.navy }}>
            מה את מקבלת בקורס?
          </h2>
          <p className="text-[18px] sm:text-[20px] text-center mt-2 leading-relaxed" style={{ color: C.ink }}>
            4 קורסים שיהפכו אותך למפתחת רלוונטית ויפתחו לך בעז״ה דלתות נוספות.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {GETS.map(([color, lead, t, b]) => (
              <li key={t} className="flex items-start gap-3 rounded-[18px] px-4 py-3" style={{ background: C.bg }}>
                <span className="mt-3 w-3.5 h-3.5 rounded-full shrink-0" style={{ background: color }} aria-hidden />
                <div>
                  <div className="font-black text-[18px] leading-tight" style={{ color: C.navy }}>
                    <span className="font-black text-[30px] sm:text-[34px] align-baseline" style={{ color }}>
                      {lead}
                    </span>{" "}
                    {t}
                  </div>
                  <div className="text-[15px] leading-relaxed mt-1">{b}</div>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="font-black text-[22px] sm:text-[26px] text-center mt-9" style={{ color: C.navy }}>
            למה דווקא הנושאים האלה?
          </h3>
          <p className="text-[17px] text-center mt-2 leading-relaxed">מהמחקר שלנו בתעשייה, אלו המיומנויות הנדרשות ביותר בשוק.</p>
        </section>

        {/* Price */}
        <section className="bg-white rounded-[32px] px-6 py-8 sm:px-10 shadow-sm text-center">
          <h2 className="font-black text-[28px] sm:text-[34px]" style={{ color: C.navy }}>
            כמה זה עולה?
          </h2>
          <div className="mt-5 flex flex-col gap-3 max-w-md mx-auto">
            <div className="flex items-baseline justify-between gap-3 text-[18px]">
              <span>מחיר הקורס המלא</span>
              <span className="font-black text-[24px] line-through decoration-2" style={{ color: C.pink, textDecorationColor: C.pink }}>
                12,000 ₪
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-[18px]">
              <span>
                מימון מטעם שופרא
                <span className="block text-[12px]" style={{ color: C.muted }}>
                  מותנה בהגשה למבחן חיצוני
                </span>
              </span>
              <span className="font-black text-[22px]" style={{ color: C.tealDeep }}>
                - 6,000 ₪
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-[18px]">
              <span>
                מלגה למנויות קוד פתוח
                <span className="block text-[12px]" style={{ color: C.muted }}>
                  מנוי לאורך שנת הקורס
                </span>
              </span>
              <span className="font-black text-[22px]" style={{ color: C.tealDeep }}>
                - 4,500 ₪
              </span>
            </div>
            <div className="border-t-2 mt-1 pt-4" style={{ borderColor: C.teal }}>
              <div className="text-[16px]" style={{ color: C.navy }}>
                מחיר הקורס הסופי
              </div>
              <div className="font-black text-[22px] mt-1" style={{ color: C.navy }}>
                12 × 125 ₪ =
              </div>
              <div className="inline-block rounded-[22px] px-8 py-2 mt-2" style={{ background: C.yellow }}>
                <span className="font-black text-[44px] sm:text-[56px] leading-none" style={{ color: C.navy }}>
                  1,500 ₪
                </span>
              </div>
            </div>
          </div>

          <div className="max-w-xl mx-auto mt-7 rounded-[22px] px-5 py-5" style={{ background: C.bg }}>
            <p className="font-black text-[19px] sm:text-[21px] leading-snug" style={{ color: C.navy }}>
              איך יכול להיות שנה שלמה עם התכנים הכי יקרים במחיר כזה?
            </p>
            <p className="text-[16.5px] sm:text-[17.5px] leading-relaxed mt-2">
              כי אנחנו מאמינים שאת צריכה עבודה, ולא לשלם הרבה כסף על חלומות. לכן השגנו בשבילך מימון.
            </p>
          </div>

          <Link
            href="/masters-course/register"
            className="inline-flex items-center justify-center gap-2 mt-8 rounded-full px-10 py-4 font-black text-[21px] text-white shadow-md hover:brightness-105 transition-[filter]"
            style={{ background: C.pink }}
          >
            אני נרשמת לקורס 💜
          </Link>
          <p className="text-[13.5px] mt-3" style={{ color: C.muted }}>
            ההרשמה לוקחת דקה: מייל, שם וטלפון, ומשם לדף התשלום המאובטח.
            <br />
            רוצה לשאול קודם?{" "}
            <a href={WA_URL} target="_blank" rel="noopener noreferrer" className="font-bold underline" style={{ color: C.navy }}>
              דברי איתנו בוואטסאפ
            </a>
          </p>
        </section>

        <CourseFooter />
      </div>
    </main>
  );
}
