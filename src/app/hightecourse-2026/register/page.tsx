import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { rubik } from "@/app/ai-course/font";
import { CONFERENCE_TITLE, DAY, PATHS } from "@/lib/conference-shared";
import { ConferenceFooter, ConferenceHeader, H } from "../chrome";
import { RegisterForm } from "./form";

export const metadata: Metadata = {
  title: { absolute: `הרשמה ליום חמישי | ${CONFERENCE_TITLE}` },
  description: `הרשמה ליום השלישי של הייטקורס 2026 - ${DAY.label} ${DAY.date}. משתתפת יחידה או קבוצה.`,
  robots: { index: false },
  icons: { icon: "/ai-course/icon.png" },
  other: { google: "notranslate" },
};

/**
 * The registration form (the owner, 17/11): a single participant or a group
 * with one contact, the owner's fields, credit card (→ the secure payment
 * page) or a bank transfer against an invoice sent by mail.
 */
export default async function ConferenceRegisterPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  return (
    <div dir="rtl" translate="no" className={`${rubik.className} notranslate flex min-h-screen flex-col`} style={{ background: H.bg, color: H.ink }}>
      <ConferenceHeader
        right={
          <Link href={PATHS.landing} className="inline-flex items-center gap-1.5 text-[14.5px] font-bold hover:underline" style={{ color: H.navy }}>
            <ArrowRight size={16} strokeWidth={2.6} />
            לדף הכנס
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
        <p className="text-[14px] font-bold" style={{ color: H.muted }}>
          הייטקורס 2026 · היום השלישי
        </p>
        <h1 className="mt-1 text-[32px] font-black leading-tight sm:text-[40px]" style={{ color: H.navy }}>
          הרשמה ליום חמישי
        </h1>
        <p className="mt-2 text-[16.5px] leading-relaxed">
          {DAY.label} | <span dir="ltr">{DAY.date}</span> | {DAY.hebrew} · התכנסות ובופה בוקר מ-08:00, סיום ב-17:00.
        </p>
        <div className="mt-7">
          <RegisterForm initialKind={kind === "group" ? "group" : "single"} />
        </div>
      </main>
      <ConferenceFooter />
    </div>
  );
}
