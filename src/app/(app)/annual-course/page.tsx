import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileDown, ExternalLink, Phone, Mail } from "lucide-react";
import { requireCommunityAccess, isSubscriber } from "@/lib/auth";
import { Squiggle, H26Style } from "@/app/hackathon-2026/shared";
import { C, CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_HREF, SHUFRA_EMAIL, courseMailto } from "@/app/masters-course/theme";

export const metadata: Metadata = { title: "קורס שנתי ממומן" };
export const dynamic = "force-dynamic";

/** The syllabus PDF lives in public/ - served from our own domain, so it
    opens behind Netfree too (same reason as /api/files). */
const SYLLABUS_HREF = "/masters-course/syllabus.pdf";
const SYLLABUS_FILENAME = "סילבוס מאסטרית בהייטק.pdf";

// The four courses: the ad's titles (the owner, 25/9: "בקוביות תשאיר את
// הטקסט כמו במודעה"), with the syllabus' one-line taglines under them.
const COURSES = [
  { color: C.yellow, title: "פיתוח פתרונות AI מתקדמים", sub: "מ-Developer ל-AI Engineer: בונות, מודדות, מאבטחות ופורסות מערכות AI" },
  { color: C.tealDeep, title: "ארכיטקטורה למערכות מורכבות", sub: "שיטה חדשה ללמוד ארכיטקטורה מהידיים - מה שפעם למדו רק בעבודה" },
  { color: C.orange, title: "Vibe Coding", sub: "פיתוח מקצה לקצה עם אייג׳נטים של AI - מהרעיון עד לאוויר" },
  { color: C.pink, title: "ניהול מוצר והבנה עסקית", sub: "כי היום מפתחת צריכה לראות את התמונה השלמה - ולנהל אייג׳נטים" },
];

/**
 * The in-community page for the funded annual course (the owner, 12/10:
 * "קורס שנתי ממומן עם אינדיקציה של חדש, עם המידע הבסיסי - הורדת סילבוס
 * והפניה לדף המלא"): the community header motif, one gradient banner with
 * the syllabus download and the link to the full sales page, the four
 * courses, the price in a few lines, and the registration button. Open to
 * every signed-in member; the scholarship line speaks to subscribers.
 */
export default async function AnnualCoursePage() {
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <H26Style />
      {/* ── header - the community motif ── */}
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;קורס שנתי ממומן/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">
          מאסטרית{" "}
          <span className="relative inline-block">
            <span className="t-gradient">בהייטק</span>
            <Squiggle className="absolute -bottom-0.5 right-0 w-full" />
          </span>
        </h1>
        <p className="t-body-sm text-ink-700">הקורס השנתי של שופרא, קוד פתוח והייטקורס - 4 קורסים מבוקשים בקורס מעמיק אחד, ב-90% מימון.</p>
      </div>

      {/* ── banner ── */}
      <section className="relative overflow-hidden bg-brand-gradient rounded-[22px] px-6 py-5 text-white shadow-glow-pink flex items-center gap-3 flex-wrap">
        <div className="font-display font-black text-[19px] leading-snug">
          שנה שלמה עם התכנים הכי יקרים בהייטק - ב-1,500 ₪ למנויות 🎓
        </div>
        <div className="flex items-center gap-2 flex-wrap ms-auto">
          <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/30 px-3 py-1 rounded-full text-[13px] font-bold">
            <CalendarDays size={14} /> קורס שנתי · 12 × 125 ₪
          </span>
          <a
            href={SYLLABUS_HREF}
            download={SYLLABUS_FILENAME}
            className="inline-flex items-center gap-1.5 bg-white text-brand-purple font-display font-bold text-[13.5px] px-4 py-1.5 rounded-full hover:bg-tint-purple transition-colors"
          >
            <FileDown size={14} /> הורדת הסילבוס (PDF)
          </a>
          <a
            href="/masters-course"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-white/15 border border-white/40 text-white font-display font-bold text-[13.5px] px-4 py-1.5 rounded-full hover:bg-white/25 transition-colors"
          >
            לדף המלא <ExternalLink size={13} />
          </a>
        </div>
      </section>

      {/* ── the four courses ── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[20px] font-black text-ink-1000">4 קורסים בקורס אחד</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COURSES.map((c) => (
            <article key={c.title} className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex gap-3">
              <span className="mt-1.5 w-3.5 h-3.5 rounded-full shrink-0" style={{ background: c.color }} aria-hidden />
              <span className="min-w-0">
                <span className="block font-display font-black text-[16.5px] leading-tight text-ink-1000">{c.title}</span>
                <span className="block text-[13.5px] text-ink-700 leading-relaxed mt-1">{c.sub}</span>
              </span>
            </article>
          ))}
        </div>
      </section>

      {/* ── the basics: who, how much, where to ask ── */}
      <section className="bg-white border border-ink-200 rounded-[18px] p-5 sm:p-6 shadow-sm flex flex-col gap-4">
        <h2 className="font-display text-[18px] font-black text-ink-1000">המידע הבסיסי</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-[14px]">
          <dt className="font-bold text-ink-900">מי מעבירה</dt>
          <dd className="text-ink-800">שופרא בשיתוף קוד פתוח והייטקורס. תוכנית גמישה ומותאמת למצב השוק.</dd>
          <dt className="font-bold text-ink-900">מחיר מלא</dt>
          <dd className="text-ink-800">
            <span className="line-through text-ink-500">12,000 ₪</span>
          </dd>
          <dt className="font-bold text-ink-900">מימון שופרא</dt>
          <dd className="text-ink-800">
            6,000 ₪ <span className="text-ink-500 text-[12.5px]">(מותנה בהגשה למבחן חיצוני)</span>
          </dd>
          <dt className="font-bold text-ink-900">מלגה למנויות</dt>
          <dd className="text-ink-800">
            4,500 ₪ <span className="text-ink-500 text-[12.5px]">(מנוי קוד פתוח לאורך שנת הקורס)</span>
          </dd>
          <dt className="font-bold text-ink-900">המחיר שלך</dt>
          <dd className="font-black text-[16px] text-ink-1000">
            12 × 125 ₪ = 1,500 ₪ <span className="text-[12.5px] font-medium text-ink-500">למנויות</span>
          </dd>
          <dt className="font-bold text-ink-900">שאלות</dt>
          <dd className="text-ink-800 flex flex-wrap gap-x-4 gap-y-1">
            <a href={CONTACT_PHONE_HREF} dir="ltr" className="inline-flex items-center gap-1 font-bold text-brand-purple hover:underline">
              <Phone size={13} /> {CONTACT_PHONE}
            </a>
            <a href={courseMailto(SHUFRA_EMAIL)} className="inline-flex items-center gap-1 font-bold text-brand-purple hover:underline">
              <Mail size={13} /> {SHUFRA_EMAIL}
            </a>
            <a href={courseMailto(CONTACT_EMAIL)} className="inline-flex items-center gap-1 font-bold text-brand-purple hover:underline">
              <Mail size={13} /> {CONTACT_EMAIL}
            </a>
          </dd>
        </dl>

        {!subscriber && (
          <p className="text-[13.5px] text-ink-700 bg-tint-purple/50 border border-brand-purple/20 rounded-[14px] px-4 py-3">
            המלגה של 4,500 ₪ היא למנויות קוד פתוח לאורך שנת הקורס.{" "}
            <Link href="/subscription" className="font-bold text-brand-purple hover:underline">
              להצטרפות למנוי (12 × 39 ₪) ←
            </Link>
          </p>
        )}

        <div className="flex items-center gap-3 flex-wrap pt-1">
          <Link
            href="/masters-course/register"
            className="inline-flex items-center gap-1.5 text-[14px] font-bold text-white bg-brand-gradient px-5 py-2.5 rounded-full hover:brightness-105 transition-[filter]"
          >
            אני נרשמת לקורס 💜 <ArrowLeft size={14} />
          </Link>
          <a href={SYLLABUS_HREF} download={SYLLABUS_FILENAME} className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-brand-purple hover:underline">
            <FileDown size={14} /> הסילבוס המלא להורדה
          </a>
          <span className="text-[12.5px] text-ink-500">ההרשמה לוקחת דקה: מייל, שם וטלפון, ומשם לדף התשלום המאובטח.</span>
        </div>
      </section>
    </div>
  );
}
