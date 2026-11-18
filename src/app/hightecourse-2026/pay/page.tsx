import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rubik } from "@/app/ai-course/font";
import { buildConferencePaymentFields, loadOrder } from "@/lib/conference";
import { CONFERENCE_TITLE, DAY, PATHS, PRICE, nis } from "@/lib/conference-shared";
import { ConferenceFooter, ConferenceHeader, H } from "../chrome";
import { ConferenceCheckout } from "./checkout";

export const metadata: Metadata = { title: { absolute: `תשלום | ${CONFERENCE_TITLE}` }, robots: { index: false }, icons: { icon: "/ai-course/icon.png" } };
export const dynamic = "force-dynamic";

/** The secure card form (our Nedarim iframe, a one-time charge) for a credit-card order. */
export default async function ConferencePayPage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o } = await searchParams;
  const order = o ? await loadOrder({ token: o }) : null;
  if (order && (order.status === "paid" || order.status === "paid_reported" || order.status === "awaiting_transfer")) redirect(`${PATHS.done}?o=${order.pay_token}`);

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${proto}://${host}` : "");
  const fields = order && order.status === "pending" ? buildConferencePaymentFields(order, origin) : null;

  return (
    <div dir="rtl" translate="no" className={`${rubik.className} notranslate flex min-h-screen flex-col`} style={{ background: H.bg, color: H.ink }}>
      <ConferenceHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
        {!order ? (
          <section className="rounded-[26px] bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-[26px] font-black" style={{ color: H.navy }}>
              לא מצאנו את ההרשמה
            </h1>
            <p className="mt-2 text-[16px] leading-relaxed">הקישור לא מזוהה. אפשר להירשם מחדש, או לכתוב לנו.</p>
            <Link href={PATHS.register} className="mt-5 inline-flex rounded-full px-6 py-3 font-black text-white" style={{ background: H.navy }}>
              לטופס ההרשמה
            </Link>
          </section>
        ) : order.status === "canceled" ? (
          <section className="rounded-[26px] bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-[26px] font-black" style={{ color: H.navy }}>
              ההרשמה הזו בוטלה
            </h1>
            <p className="mt-2 text-[16px] leading-relaxed">אם זו טעות - כתבי לנו, או הירשמי מחדש.</p>
            <Link href={PATHS.register} className="mt-5 inline-flex rounded-full px-6 py-3 font-black text-white" style={{ background: H.navy }}>
              לטופס ההרשמה
            </Link>
          </section>
        ) : (
          <>
            <p className="text-[14px] font-bold" style={{ color: H.muted }}>
              הייטקורס 2026 · {DAY.label} <span dir="ltr">{DAY.date}</span>
            </p>
            <h1 className="mt-1 text-[30px] font-black leading-tight sm:text-[36px]" style={{ color: H.navy }}>
              תשלום מאובטח
            </h1>
            <section className="mt-5 rounded-[22px] bg-white p-5 shadow-sm" data-testid="hc-pay-summary">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[16px] font-black" style={{ color: H.navy }}>
                    {order.kind === "group" ? `${order.company ?? "קבוצה"} · ${order.participant_count} משתתפות` : `${order.participants[0]?.first_name ?? ""} ${order.participants[0]?.last_name ?? ""}`}
                  </div>
                  <div className="text-[14px]" style={{ color: H.muted }}>
                    {order.participant_count} × {nis(order.unit_price_nis)} ₪
                    {order.unit_price_nis < PRICE.single ? ` (מחיר קבוצה, במקום ${nis(PRICE.single)} ₪)` : ""} · מספר הרשמה <span dir="ltr">{order.short_code}</span>
                  </div>
                </div>
                <div className="text-[34px] font-black leading-none" style={{ color: H.navy }} data-testid="hc-pay-amount">
                  {nis(order.amount_nis)} ₪
                </div>
              </div>
            </section>
            <section className="mt-4 rounded-[22px] bg-white p-5 shadow-sm">
              {fields ? (
                <ConferenceCheckout fields={fields} token={order.pay_token} amountNis={order.amount_nis} />
              ) : (
                <p className="text-[15.5px] leading-relaxed">
                  דף התשלום עוד לא מוגדר בסביבה הזו. ההרשמה שלך שמורה (מספר <span dir="ltr">{order.short_code}</span>) - נחזור אלייך עם דרך לתשלום.
                </p>
              )}
            </section>
          </>
        )}
      </main>
      <ConferenceFooter />
    </div>
  );
}
