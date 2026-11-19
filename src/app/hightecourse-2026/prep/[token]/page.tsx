import type { Metadata } from "next";
import { rubik } from "@/app/ai-course/font";
import { CONF, installListFor, KIND_LABEL, questionsFor, type PrepKind } from "@/lib/hc-preconf/config";
import { initialAnswersOf, loadPrepByToken } from "@/lib/hc-preconf/data";
import { ConferenceFooter, ConferenceHeader, H } from "../../chrome";
import { PrepForm } from "../prep-form";

export const metadata: Metadata = {
  title: { absolute: `שאלון הכנה | ${CONF.title}` },
  robots: { index: false, follow: false },
  icons: { icon: "/ai-course/icon.png" },
  other: { google: "notranslate" },
};
export const dynamic = "force-dynamic";

/**
 * The questionnaire behind the button in the pre-conference mail (the owner,
 * 19/11): the link carries her token, so the page knows who she is and which
 * course she is in, and starts from what she already told the earlier form.
 */
export default async function PrepPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await loadPrepByToken(token);
  const kind = (row?.course_kind ?? "unknown") as PrepKind;
  return (
    <div dir="rtl" translate="no" className={`${rubik.className} notranslate flex min-h-screen flex-col`} style={{ background: H.bg, color: H.ink }}>
      <ConferenceHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
        {!row ? (
          <section className="rounded-[26px] bg-white p-6 shadow-sm sm:p-9" data-testid="prep-invalid">
            <h1 className="text-[26px] font-black" style={{ color: H.navy }}>
              הקישור לא תקין
            </h1>
            <p className="mt-2 text-[16px] leading-relaxed">
              השאלון נפתח מהקישור האישי שבמייל ״{CONF.subject}״. לא מוצאת אותו? כתבי לנו ל-
              <a href={`mailto:${CONF.replyTo}`} className="font-bold" dir="ltr" style={{ color: H.navy }}>
                {CONF.replyTo}
              </a>
              .
            </p>
          </section>
        ) : (
          <>
            <p className="text-[14px] font-bold" style={{ color: H.muted }}>
              {CONF.title} · {CONF.dates}
            </p>
            <h1 className="mt-1 text-[30px] font-black leading-tight sm:text-[36px]" style={{ color: H.navy }}>
              שאלון הכנה לקורס
            </h1>
            <p className="mt-2 text-[16px] leading-relaxed" data-testid="prep-who">
              שלום <b>{row.first_name}</b>, נרשמת לקורס <b data-testid="prep-course">{row.course || row.course_raw}</b>
              {row.is_sample ? ` (דוגמה - ${KIND_LABEL[kind]})` : ""}. השאלון לוקח דקה, והתשובות נשמרות לכתובת <span dir="ltr">{row.email}</span>.
            </p>
            <div className="mt-6">
              <PrepForm token={row.token} kind={kind} laptopRequired={row.laptop_required} questions={questionsFor(kind, row.laptop_required)} initial={initialAnswersOf(row)} answeredAt={row.answered_at} installList={installListFor(row.course)} />
            </div>
          </>
        )}
      </main>
      <ConferenceFooter />
    </div>
  );
}
