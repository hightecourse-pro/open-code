import type { Metadata } from "next";
import Link from "next/link";
import { rubik } from "@/app/ai-course/font";
import { loadOrder } from "@/lib/conference";
import { CONFERENCE_TITLE, DAY, PATHS, PAYMENT_LABEL, nis, type PaymentMethod } from "@/lib/conference-shared";
import { ConferenceFooter, ConferenceHeader, H } from "../chrome";

export const metadata: Metadata = { title: { absolute: `ההרשמה התקבלה | ${CONFERENCE_TITLE}` }, robots: { index: false }, icons: { icon: "/ai-course/icon.png" } };
export const dynamic = "force-dynamic";

/** The thank-you page - what she registered, how she pays, what happens next. Idempotent; a refresh changes nothing. */
export default async function ConferenceDonePage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o } = await searchParams;
  const order = o ? await loadOrder({ token: o }) : null;
  const first = order ? (order.kind === "group" ? (order.contact_name ?? "").split(/\s+/)[0] : order.participants[0]?.first_name) : "";
  const credit = order?.payment_method === "credit";
  const pendingCard = order?.status === "pending";

  return (
    <div dir="rtl" translate="no" className={`${rubik.className} notranslate flex min-h-screen flex-col`} style={{ background: H.bg, color: H.ink }}>
      <ConferenceHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
        <section className="rounded-[26px] bg-white p-6 shadow-sm sm:p-9" data-testid="hc-done">
          {!order ? (
            <>
              <h1 className="text-[28px] font-black" style={{ color: H.navy }}>
                תודה!
              </h1>
              <p className="mt-2 text-[16px] leading-relaxed">לא הצלחנו לזהות את ההרשמה מהקישור הזה. אם נרשמת - הכול בסדר, קיבלת מייל אישור.</p>
            </>
          ) : order.status === "canceled" ? (
            <>
              <h1 className="text-[28px] font-black" style={{ color: H.navy }}>
                ההרשמה הזו בוטלה
              </h1>
              <p className="mt-2 text-[16px] leading-relaxed">אם זו טעות - כתבי לנו, או הירשמי מחדש.</p>
            </>
          ) : pendingCard ? (
            <>
              <h1 className="text-[28px] font-black" style={{ color: H.navy }}>
                עוד לא ראינו תשלום
              </h1>
              <p className="mt-2 text-[16px] leading-relaxed">
                ההרשמה (מספר <span dir="ltr">{order.short_code}</span>) שמורה, אבל התשלום בכרטיס עוד לא הושלם. אפשר להשלים אותו עכשיו.
              </p>
              <Link href={`${PATHS.pay}?o=${order.pay_token}`} className="mt-5 inline-flex rounded-full px-6 py-3 font-black text-white" style={{ background: H.navy }} data-testid="hc-done-pay">
                לתשלום מאובטח · {nis(order.amount_nis)} ₪
              </Link>
            </>
          ) : (
            <>
              <div className="inline-block rounded-2xl px-5 py-2 text-[22px] font-black" style={{ background: H.yellow, color: H.navy }}>
                {first ? `${first}, ` : ""}
                {order.kind === "group" ? "הקבוצה רשומה!" : "נרשמת!"}
              </div>
              <h1 className="mt-5 text-[28px] font-black leading-tight sm:text-[32px]" style={{ color: H.navy }}>
                נתראה ב{DAY.label}, <span dir="ltr">{DAY.date}</span>
              </h1>
              <p className="mt-1 text-[15.5px] font-bold" style={{ color: H.muted }}>
                {DAY.hebrew} · התכנסות ובופה בוקר מ-08:00
              </p>
              <dl className="mt-6 grid gap-3 text-[15.5px] sm:grid-cols-2">
                <div className="rounded-2xl px-4 py-3" style={{ background: H.row }}>
                  <dt className="text-[13px] font-bold" style={{ color: H.muted }}>
                    {order.kind === "group" ? "משתתפות" : "משתתפת"}
                  </dt>
                  <dd className="font-bold">
                    {order.kind === "group"
                      ? `${order.participant_count} · ${order.company ?? ""}`
                      : `${order.participants[0]?.first_name ?? ""} ${order.participants[0]?.last_name ?? ""}`}
                  </dd>
                </div>
                <div className="rounded-2xl px-4 py-3" style={{ background: H.row }}>
                  <dt className="text-[13px] font-bold" style={{ color: H.muted }}>
                    סכום
                  </dt>
                  <dd className="font-bold">
                    {nis(order.amount_nis)} ₪ ({order.participant_count} × {nis(order.unit_price_nis)} ₪)
                  </dd>
                </div>
                <div className="rounded-2xl px-4 py-3 sm:col-span-2" style={{ background: H.row }}>
                  <dt className="text-[13px] font-bold" style={{ color: H.muted }}>
                    תשלום
                  </dt>
                  <dd className="font-bold" data-testid="hc-done-payment">
                    {PAYMENT_LABEL[order.payment_method as PaymentMethod]}
                    {credit ? (order.status === "paid" ? " - התקבל ואושר. הקבלה נשלחת ממערכת הסליקה." : " - נקלט בדף התשלום ומאומת בדקות הקרובות.") : " - החשבונית לתשלום תישלח אלייך במייל."}
                  </dd>
                </div>
              </dl>
              {order.kind === "group" && (
                <ul className="mt-4 flex flex-wrap gap-2 text-[14px]" data-testid="hc-done-participants">
                  {order.participants.map((p) => (
                    <li key={p.id} className="rounded-full border px-3 py-1 font-bold" style={{ borderColor: H.line, color: H.navy }}>
                      {p.first_name} {p.last_name}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-6 text-[15px] leading-relaxed">
                שלחנו מייל אישור ל-<span dir="ltr">{order.kind === "group" ? order.contact_email : order.participants[0]?.personal_email}</span>. מספר ההרשמה שלך:{" "}
                <b dir="ltr" className="font-mono" style={{ color: H.navy }}>
                  {order.short_code}
                </b>
                .
              </p>
            </>
          )}
          <Link href={PATHS.landing} className="mt-7 inline-flex rounded-full border-2 px-6 py-3 font-black" style={{ borderColor: H.navy, color: H.navy }}>
            חזרה לדף הכנס
          </Link>
        </section>
      </main>
      <ConferenceFooter />
    </div>
  );
}
