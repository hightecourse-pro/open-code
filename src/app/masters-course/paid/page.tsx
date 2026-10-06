import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { raiseAlert } from "@/lib/alerts";
import { sendEmail } from "@/lib/email/send";
import { sendResendEmail } from "@/lib/email/resend";
import { coursePaymentReportedEmail, coursePaymentThanksEmail } from "@/lib/email/templates";
import { courseNotifyEmail } from "@/lib/course-registration";
import { C, CourseFooter, PartnersHeader, rubik } from "../shared";

export const metadata: Metadata = { title: "ההרשמה לקורס התקבלה", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Where Shufra's Nedarim page sends her browser after a successful charge
 * (the Redirect parameter we attach to the payment link - the owner, 6/10).
 * No callback exists on their mosad, so this return IS our signal: the
 * registration moves to "reported as paid", she gets a confirmation, the team
 * gets an alert and verifies against Shufra's report by the registration code.
 * Idempotent - a refresh changes nothing.
 */
export default async function CoursePaidPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  const token = (r ?? "").trim();
  const admin = createAdminClient();
  const { data: reg } = /^[0-9a-f]{32}$/.test(token)
    ? await admin
        .from("course_registrations")
        .select("id, full_name, first_name, email, phone, reg_code, status, is_subscriber")
        .eq("pay_token", token)
        .maybeSingle()
    : { data: null };

  if (reg && reg.status === "registered") {
    const now = new Date().toISOString();
    const { data: moved } = await admin
      .from("course_registrations")
      .update({ status: "paid_reported", payment_reported_at: now, updated_at: now })
      .eq("id", reg.id)
      .eq("status", "registered")
      .select("id");
    // Only the request that actually moved the row sends the mails.
    if (moved?.length) {
      const regCode = reg.reg_code ?? "";
      try {
        await raiseAlert({
          kind: "course_payment_reported",
          severity: "info",
          title: `חזרה מדף התשלום לקורס: ${reg.full_name} (${regCode})`,
          body: `${reg.email} · ${reg.phone ?? ""} · לאמת מול דוח נדרים של שופרא לפי הקוד, ואז לסמן ״שולם ✓״.`,
          dedupeKey: `course_payment_reported:${reg.id}`,
        });
      } catch {
        /* best-effort */
      }
      try {
        const team = coursePaymentReportedEmail({ fullName: reg.full_name, email: reg.email, phone: reg.phone ?? "", regCode, isSubscriber: reg.is_subscriber });
        await sendEmail({ to: courseNotifyEmail(), subject: team.subject, html: team.html });
      } catch {
        /* best-effort */
      }
      try {
        const mail = coursePaymentThanksEmail(reg.first_name ?? reg.full_name.split(/\s+/)[0], regCode);
        await sendResendEmail({ to: reg.email, subject: mail.subject, html: mail.html });
      } catch {
        /* best-effort */
      }
    }
  }

  const first = reg?.first_name ?? reg?.full_name?.split(/\s+/)[0] ?? null;
  return (
    <main dir="rtl" className={`${rubik.className} min-h-screen`} style={{ background: C.bg, color: C.ink }}>
      <div className="max-w-2xl mx-auto px-5 py-10 sm:py-14 flex flex-col gap-8">
        <PartnersHeader />
        <section className="bg-white rounded-[32px] px-6 py-9 sm:px-10 sm:py-12 shadow-sm text-center">
          {reg ? (
            <>
              <div className="inline-block rounded-[22px] px-6 py-2" style={{ background: C.teal }}>
                <span className="font-black text-[26px] sm:text-[32px]" style={{ color: C.navy }}>
                  {first ? `${first}, ` : ""}נרשמת! 🎉
                </span>
              </div>
              <h1 className="font-black text-[26px] sm:text-[32px] leading-tight mt-5" style={{ color: C.navy }}>
                ברוכה הבאה לקורס <span style={{ color: C.pink }}>מאסטרית בהייטק</span>
              </h1>
              <p className="text-[17px] leading-relaxed mt-4">
                התשלום נקלט בדף התשלום של שופרא, וההרשמה שלך אצלנו. שלחנו לך מייל אישור, ובימים הקרובים נשלח את כל הפרטים:
                מועדי המפגשים, הקבוצה וחומרי הפתיחה.
              </p>
              {reg.reg_code && (
                <p className="mt-5 text-[15px]" style={{ color: C.muted }}>
                  קוד ההרשמה שלך:{" "}
                  <b dir="ltr" className="font-mono text-[17px]" style={{ color: C.navy }}>
                    {reg.reg_code}
                  </b>
                </p>
              )}
              {reg.is_subscriber && (
                <p className="mt-4 rounded-[18px] px-4 py-3 text-[15px] leading-relaxed" style={{ background: C.bg }}>
                  תזכורת: מלגת המנויות מותנית במנוי פעיל בקוד פתוח לאורך כל שנת הקורס.
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="font-black text-[26px] sm:text-[32px] leading-tight" style={{ color: C.navy }}>
                תודה!
              </h1>
              <p className="text-[17px] leading-relaxed mt-4">
                לא הצלחנו לזהות את ההרשמה מהקישור הזה. אם השלמת תשלום - הכול בסדר, פשוט כתבי לנו ונאשר לך.
              </p>
            </>
          )}
          <Link
            href="/masters-course"
            className="inline-flex items-center justify-center mt-7 rounded-full px-7 py-3 font-black text-[16px]"
            style={{ background: "white", color: C.navy, border: `2px solid ${C.navy}` }}
          >
            חזרה לדף הקורס
          </Link>
        </section>
        <CourseFooter />
      </div>
    </main>
  );
}
