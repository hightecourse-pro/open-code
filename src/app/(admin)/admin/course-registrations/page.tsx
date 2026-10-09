import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site";
import {
  COURSE_KEY,
  COURSE_TITLE,
  SHUFRA_MOSAD_ID,
  courseCallbackUrl,
  courseForwardUrl,
  courseNedarimGroups,
  courseNotifyEmail,
  coursePaymentAmountOverride,
  coursePaymentUrl,
  coursePaymentUrlFull,
  courseShufraEmail,
} from "@/lib/course-registration";
import { RegistrationsTable, type RegistrationRow } from "./registrations-table";
import { UnmatchedPayments, type UnmatchedPayment } from "./unmatched-payments";
import { CourseSettingsForm } from "./course-settings-form";

export const metadata: Metadata = { title: "נרשמות לקורס" };
export const dynamic = "force-dynamic";

/**
 * נרשמות לקורס (the owner, 25/9): every woman who went through
 * /masters-course/register - subscriber or not, where she stands with the
 * payment, and a note. Since 9/10 the payment arrives by itself through
 * Shufra's Nedarim CallBack; what could not be matched waits here for a hand.
 */
export default async function CourseRegistrationsPage() {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("course_registrations")
    .select(
      "id, email, full_name, phone, profile_id, is_subscriber, membership_note, status, paid_at, notes, created_at, reg_code, payment_reported_at, payment_amount_agorot, payment_installments, nedarim_transaction_id"
    )
    .eq("course_key", COURSE_KEY)
    .order("created_at", { ascending: false })
    .limit(2000);
  const rows = (data ?? []) as RegistrationRow[];

  // Live membership beside the snapshot: a woman who joined AFTER registering
  // should read as a subscriber now (the scholarship follows the membership).
  const ids = rows.map((r) => r.profile_id).filter((x): x is string => !!x);
  const liveSub = new Map<string, boolean>();
  if (ids.length) {
    const { inChunks } = await import("@/lib/chunk");
    const profs = await inChunks<{ id: string; status: string; member_tier: string }>(ids, (chunk) =>
      admin.from("profiles").select("id, status, member_tier").in("id", chunk)
    );
    for (const p of profs) liveSub.set(p.id, p.status === "active" && p.member_tier === "paid");
  }
  const withLive = rows.map((r) => ({ ...r, subscriber_now: r.profile_id ? (liveSub.get(r.profile_id) ?? false) : false }));

  // Course-looking payments the callback could not hang on a registration.
  const { data: unmatchedRows } = await admin
    .from("course_payments")
    .select("id, transaction_id, amount_agorot, installments, client_name, email, phone, groupe, comments, created_at")
    .eq("course_key", COURSE_KEY)
    .is("registration_id", null)
    .eq("status", "ok")
    .order("created_at", { ascending: false })
    .limit(200);
  const unmatched = (unmatchedRows ?? []) as UnmatchedPayment[];
  const options = rows
    .filter((r) => r.status !== "canceled")
    .map((r) => ({ id: r.id, full_name: r.full_name, email: r.email, reg_code: r.reg_code ?? null, status: r.status }));

  const callbackUrl = courseCallbackUrl(getSiteUrl());
  const { getCourseSettings } = await import("@/lib/course-settings");
  const settings = await getCourseSettings();
  const envOverride = coursePaymentAmountOverride();
  const forwardTo = courseForwardUrl("transactions");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display font-bold text-[24px] text-ink-1000">נרשמות לקורס {COURSE_TITLE}</h1>
        <p className="text-[13.5px] text-ink-600 mt-1 leading-relaxed">
          כל מי שנרשמה בדף הציבורי (/masters-course/register). התשלום נסלק בנדרים של שופרא, והקולבק שלהן מדווח לכאן: תשלום
          שמזוהה לפי קוד ההרשמה (מופיע בהערת התשלום) או לפי המייל מסומן אוטומטית ״שולם ✓״ עם הסכום ומספר התשלומים, יוצאת
          התראה, נשלח מייל לשופרא ({courseShufraEmail()}) ול-{courseNotifyEmail()}, ומייל אישור לנרשמת. תשלום שנראה כמו הקורס
          (קבוצה ״{courseNedarimGroups().join("״ / ״")}״ או סכום של הקורס) בלי הרשמה תואמת ממתין לשיוך למטה; שאר התשלומים
          של שופרא לא נרשמים. מי שחזרה מדף התשלום לפני שהקולבק הגיע מסומנת ״חזרה מדף התשלום - לאימות״.
        </p>
        <p className="text-[12px] text-ink-500 mt-1" dir="ltr">
          דף התשלום למנויות (1,500 ₪): {coursePaymentUrl()}
          <br />
          דף התשלום בלי מלגה (6,000 ₪): {coursePaymentUrlFull()}
        </p>
        <div className="mt-2">
          <CourseSettingsForm amountOverride={settings.amountOverride} envOverride={envOverride} />
        </div>
        <details className="mt-2 rounded-[14px] border border-ink-100 bg-white px-4 py-3 text-[13px] text-ink-700">
          <summary className="cursor-pointer font-semibold text-ink-900">הגדרת ה-CallBack בנדרים של שופרא (פעם אחת)</summary>
          <ol className="list-decimal ps-5 mt-2 flex flex-col gap-1.5 leading-relaxed">
            <li>
              בממשק הניהול של נדרים פלוס של שופרא (מוסד {SHUFRA_MOSAD_ID}): הגדרות ← Webhook ← ״עדכוני עסקאות״. נדרים מאפשרים כתובת
              אחת לכל סוג עדכון; אם כבר יש שם כתובת של שופרא, הכתובת שלנו מחליפה אותה{" "}
              {forwardTo ? (
                <>
                  ומעבירה אליה כל עדכון כמו שהוא (מוגדר: <span dir="ltr">{forwardTo.slice(0, 60)}…</span>).
                </>
              ) : (
                <>- ואז צריך להגדיר אצלנו את הכתובת הישנה (COURSE_CALLBACK_FORWARD_URL) כדי שהעדכונים ימשיכו להגיע גם אליה.</>
              )}{" "}
              ״עדכוני סירובים״: אפשר להדביק את אותה כתובת (סירוב של נרשמת שלנו יתועד); ״הקמת הוראת קבע״ לא נחוץ.
            </li>
            <li>
              מדביקים את הכתובת הזו בדיוק כמו שהיא, כולל המפתח שבסוף:
              {callbackUrl ? (
                <code dir="ltr" className="block mt-1 rounded-[8px] bg-ink-50 px-2 py-1.5 text-[12px] break-all select-all">
                  {callbackUrl}
                </code>
              ) : (
                <span className="block mt-1 rounded-[8px] bg-amber-50 text-amber-800 px-2 py-1.5">
                  חסר COURSE_CALLBACK_SECRET בסביבה הזו - עד שיוגדר אין כתובת להדביק, והקולבק לא יאומת.
                </span>
              )}
            </li>
            <li>שומרים. מהרגע הזה כל תשלום בחשבון של שופרא מדווח לכאן - המערכת מסננת ושומרת רק את תשלומי הקורס.</li>
          </ol>
        </details>
      </div>
      <UnmatchedPayments payments={unmatched} registrations={options} />
      <RegistrationsTable rows={withLive} />
    </div>
  );
}
