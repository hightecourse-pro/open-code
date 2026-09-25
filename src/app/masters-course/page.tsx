import type { Metadata } from "next";
import Image from "next/image";
import { Rubik } from "next/font/google";

// The ad's rounded, friendly Hebrew face (the owner, 25/9: "בצבעים ובנראות
// של המודעה"). Loaded for this page only.
const rubik = Rubik({ subsets: ["hebrew", "latin"], weight: ["400", "500", "700", "900"], display: "swap" });

export const metadata: Metadata = {
  title: "מאסטרית בהייטק - הקורס השנתי של שופרא, קוד פתוח והייטקורס",
  description:
    "4 קורסים מבוקשים בקורס שנתי מעמיק אחד, ב-90% מימון: פיתוח פתרונות AI, Vibe Coding, ניהול מוצר וארכיטקטורה למערכות מורכבות. 1,500 ₪ למנויות קוד פתוח.",
  openGraph: {
    title: "מאסטרית בהייטק - 4 קורסים מבוקשים ב-90% מימון",
    description: "קורס שנתי מעמיק אחד: AI, Vibe Coding, ניהול מוצר, ארכיטקטורה. 12 × 125 ₪ למנויות קוד פתוח.",
  },
};

// The ad's palette.
const C = {
  bg: "#EEF4F4",
  navy: "#23405F",
  teal: "#9CCFCB",
  tealDeep: "#5FB0AA",
  yellow: "#F3C532",
  pink: "#C9386C",
  orange: "#F27A3D",
  ink: "#2B3A4A",
};

const WA_URL = "https://wa.me/97225800296?text=" + encodeURIComponent("היי, אשמח לפרטים על הקורס השנתי 'מאסטרית בהייטק'");

const COURSES = [
  {
    color: C.yellow,
    title: "פיתוח פתרונות AI מתקדמים",
    sub: "AI Agents, RAG, MCP - ברמת פרודקשן",
    body: "לפיתוח פתרונות AI ואייג׳נטים כמו שעושים את זה בפרודקשן.",
  },
  {
    color: C.teal,
    title: "ארכיטקטורה למערכות מורכבות",
    sub: "הבנה מערכתית טכנולוגית",
    body: "החידוש של 2026! קורס שילמד אותך מהידיים הבנת ארכיטקטורה במערכות מורכבות - כי כל מפתחת היום הופכת לארכיטקטית.",
  },
  {
    color: C.orange,
    title: "Vibe Coding",
    sub: "פרקטיקה לבניית מערכות מקצה לקצה עם כלי AI",
    body: "פיתוח מתקדם מקצה לקצה בכלי AI, בשילוב אוטומציות עסקיות.",
  },
  {
    color: C.pink,
    title: "ניהול מוצר והבנה עסקית",
    sub: "הבנה עסקית רחבה",
    body: "כי היום מפתחת צריכה לראות את התמונה השלמה - כל מפתחת הופכת למנהלת אייג׳נטים.",
  },
];

function Wordmark({ name, tagline, color }: { name: string; tagline: string; color: string }) {
  return (
    <div className="flex flex-col items-center leading-tight">
      <span className="font-black text-[22px] sm:text-[26px]" style={{ color }}>
        {name}
      </span>
      <span className="text-[10.5px] sm:text-[11.5px] text-[#6B7A8A]">{tagline}</span>
    </div>
  );
}

export default function MastersCoursePage() {
  return (
    <main dir="rtl" className={`${rubik.className} min-h-screen`} style={{ background: C.bg, color: C.ink }}>
      <div className="max-w-3xl mx-auto px-5 py-8 sm:py-12 flex flex-col gap-8">
        {/* Partners */}
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <Wordmark name="שופרא" tagline="מרחב מקצועי מתקדם · מבית סמינר הרב וולף" color={C.orange} />
          <Image src="/logo-opencode.png" alt="קוד פתוח - השמה. הכשרה. תרבות." width={150} height={56} className="h-12 w-auto" priority />
          <Wordmark name="הייטקורס" tagline="לחשוב בגדול" color={C.navy} />
        </header>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-9 text-right">
            {COURSES.map((c) => (
              <article key={c.title} className="relative bg-white rounded-[24px] px-6 pt-8 pb-6 shadow-sm">
                <span
                  className="absolute -top-3 right-1/2 translate-x-1/2 w-6 h-6 rounded-full"
                  style={{ background: c.color }}
                  aria-hidden
                />
                <h2 className="font-black text-[24px] sm:text-[26px] leading-tight text-center" style={{ color: c.color }}>
                  {c.title}
                </h2>
                <p className="text-[14px] text-center mt-2 font-medium" style={{ color: C.navy }}>
                  {c.sub}
                </p>
                <p className="text-[14.5px] text-center mt-2 leading-relaxed" style={{ color: C.ink }}>
                  {c.body}
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
            {[
              [C.orange, "גם קורס Vibe Coding", "פיתוח מתקדם מקצה לקצה בכלי AI בשילוב אוטומציות."],
              [C.yellow, "גם קורס פיתוח AI", "לפיתוח פתרונות AI ואייג׳נטים כמו שעושים את זה בפרודקשן."],
              [C.pink, "גם קורס ניהול מוצר והבנה עסקית", "כי היום מפתחת צריכה לראות את התמונה השלמה."],
              [C.teal, "וגם קורס ארכיטקטורה", "החידוש של 2026! קורס שילמד אותך מהידיים הבנת ארכיטקטורה במערכות מורכבות."],
            ].map(([color, t, b]) => (
              <li key={t} className="flex items-start gap-3 rounded-[18px] px-4 py-3" style={{ background: C.bg }}>
                <span className="mt-1.5 w-3.5 h-3.5 rounded-full shrink-0" style={{ background: color }} aria-hidden />
                <div>
                  <div className="font-black text-[18px]" style={{ color: C.navy }}>
                    {t}
                  </div>
                  <div className="text-[15px] leading-relaxed">{b}</div>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="font-black text-[22px] sm:text-[26px] text-center mt-9" style={{ color: C.navy }}>
            למה דווקא הנושאים האלה?
          </h3>
          <p className="text-[17px] text-center mt-2 leading-relaxed">
            מהמחקר שלנו בתעשייה, אלו המיומנויות הנדרשות ביותר בשוק.
          </p>
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
                <span className="block text-[12px] text-[#6B7A8A]">מותנה בהגשה למבחן חיצוני</span>
              </span>
              <span className="font-black text-[22px]" style={{ color: C.tealDeep }}>
                - 6,000 ₪
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-[18px]">
              <span>
                מלגה למנויות קוד פתוח
                <span className="block text-[12px] text-[#6B7A8A]">מנוי לאורך שנת הקורס</span>
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

          <a
            href={WA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 mt-8 rounded-full px-8 py-4 font-black text-[20px] text-white shadow-md hover:brightness-105 transition-[filter]"
            style={{ background: C.pink }}
          >
            💬 אני רוצה להצטרף - דברו איתי
          </a>
          <p className="text-[13.5px] mt-3 text-[#6B7A8A]">
            או במייל:{" "}
            <a href="mailto:office@opencode.org.il" className="font-bold underline" style={{ color: C.navy }}>
              office@opencode.org.il
            </a>
          </p>
        </section>

        <footer className="text-center pb-6">
          <p className="font-black text-[18px]" style={{ color: C.navy }}>
            • תוכנית גמישה ומותאמת למצב השוק •
          </p>
          <p className="text-[15px] mt-1">הקורס נולד מתוך מחקר שוק על מגמות השינויים הדרמטיים בהייטק.</p>
        </footer>
      </div>
    </main>
  );
}
