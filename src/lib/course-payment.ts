import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { raiseAlert } from "@/lib/alerts";
import { sendEmail } from "@/lib/email/send";
import { sendResendEmail } from "@/lib/email/resend";
import {
  coursePaidTeamEmail,
  coursePaymentThanksEmail,
  courseShufraPaymentEmail,
  courseUnmatchedPaymentEmail,
} from "@/lib/email/templates";
import {
  COURSE_KEY,
  courseNedarimGroups,
  courseNotifyEmail,
  courseShufraEmail,
  findRegCode,
  isCourseAmount,
} from "@/lib/course-registration";
import type { Json } from "@/types/database";

/**
 * A payment callback from Shufra's Nedarim account (the owner, 9/10).
 *
 * The account reports EVERY charge Shufra takes, so the first job is telling
 * ours apart: the registration code we plant in the payment comment, then the
 * registrant's email, then the saved page's group or a course amount (a woman
 * who paid through the raw link without registering). Everything else is
 * ignored without a trace beyond the diagnostic row.
 *
 * A matched payment: course_payments row → registration "שולם ✓" with the
 * amount and the number of installments → alert → mail to Shufra (name +
 * amount) → mail to the office → confirmation to the registrant (once).
 */
export type CoursePaymentOutcome =
  | "paid"
  | "paid_again"
  | "duplicate"
  | "unmatched_stored"
  | "ignored_unrelated"
  | "failure_noted"
  | "failure_ignored"
  | "incomplete";

export type MatchedBy = "reg_code" | "email" | "manual";

export interface CoursePaymentResult {
  outcome: CoursePaymentOutcome;
  registrationId?: string;
  transactionId?: string;
  matchedBy?: MatchedBy | null;
}

export interface RegForPayment {
  id: string;
  email: string;
  full_name: string;
  first_name: string | null;
  phone: string | null;
  reg_code: string | null;
  status: string;
  is_subscriber: boolean;
  payment_amount_agorot: number | null;
}

export const REG_PAYMENT_COLS = "id, email, full_name, first_name, phone, reg_code, status, is_subscriber, payment_amount_agorot";

const MATCHED_BY_HE: Record<MatchedBy, string> = { reg_code: "קוד ההרשמה", email: "המייל", manual: "שיוך ידני במסך הנרשמות" };

function agorot(v: string | undefined): number | null {
  if (!v) return null;
  const n = Math.round(parseFloat(String(v).replace(/[^\d.-]/g, "")) * 100);
  return Number.isFinite(n) ? n : null;
}

function int(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function findRegistration(params: Record<string, string>): Promise<{ reg: RegForPayment | null; by: MatchedBy | null }> {
  const admin = createAdminClient();
  const code = findRegCode(params.Comments, params.Comment, params.Param1, params.Param2, params.Analytic);
  if (code) {
    const { data } = await admin.from("course_registrations").select(REG_PAYMENT_COLS).eq("reg_code", code).maybeSingle();
    if (data) return { reg: data as RegForPayment, by: "reg_code" };
  }
  const email = params.Mail?.trim().toLowerCase() || params.Email?.trim().toLowerCase() || "";
  if (email) {
    const { data } = await admin
      .from("course_registrations")
      .select(REG_PAYMENT_COLS)
      .eq("course_key", COURSE_KEY)
      .ilike("email", email)
      .maybeSingle();
    if (data) return { reg: data as RegForPayment, by: "email" };
  }
  return { reg: null, by: null };
}

/** Her confirmation goes out exactly once - whichever path gets there first (callback or browser redirect). */
export async function sendCourseConfirmationOnce(reg: { id: string; email: string; full_name: string; first_name: string | null; reg_code: string | null }): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("course_registrations")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("id", reg.id)
    .is("confirmation_email_sent_at", null)
    .select("id");
  if (!data?.length) return false;
  try {
    const mail = coursePaymentThanksEmail(reg.first_name ?? reg.full_name.split(/\s+/)[0], reg.reg_code ?? "");
    await sendResendEmail({ to: reg.email, subject: mail.subject, html: mail.html });
  } catch {
    /* best-effort */
  }
  return true;
}

/**
 * A payment found its registration (by the callback or by hand): the
 * registration reads "שולם ✓" with the money on it, the team gets an alert,
 * Shufra and the office get a mail, she gets her confirmation (once).
 */
export async function markRegistrationPaid(
  reg: RegForPayment,
  pay: { transactionId: string; amountAgorot: number | null; installments: number; phone?: string | null },
  by: MatchedBy
): Promise<"paid" | "paid_again"> {
  const admin = createAdminClient();
  // A second payment on the same registration (an installment charge, a
  // correction) keeps the first summary and only adds its row.
  const already = reg.status === "paid" && reg.payment_amount_agorot != null;
  const now = new Date().toISOString();
  await admin
    .from("course_registrations")
    .update({
      status: "paid",
      paid_at: now,
      updated_at: now,
      ...(already
        ? {}
        : { payment_amount_agorot: pay.amountAgorot, payment_installments: pay.installments, nedarim_transaction_id: pay.transactionId }),
    })
    .eq("id", reg.id);

  const nis = new Intl.NumberFormat("he-IL").format((pay.amountAgorot ?? 0) / 100);
  const installmentsText = pay.installments > 1 ? ` ב-${pay.installments} תשלומים` : "";
  await raiseAlert({
    kind: "course_paid",
    severity: "info",
    title: `שולם לקורס מאסטרית: ${reg.full_name} · ${nis} ₪${installmentsText}`,
    body: `${reg.email}${reg.phone ? ` · ${reg.phone}` : ""} · ${reg.is_subscriber ? "מנויה (מחיר מלגה)" : "לא מנויה"} · קוד ${reg.reg_code ?? "-"} · זוהה לפי ${MATCHED_BY_HE[by]} · אסמכתא נדרים ${pay.transactionId}. ההרשמה סומנה ״שולם ✓״, נשלח מייל לשופרא ולנרשמת.`,
    context: { registrationId: reg.id, transactionId: pay.transactionId },
    dedupeKey: `course-paid:${pay.transactionId}`,
  });

  const details = {
    fullName: reg.full_name,
    email: reg.email,
    phone: reg.phone ?? pay.phone ?? "",
    amountAgorot: pay.amountAgorot ?? 0,
    installments: pay.installments,
    regCode: reg.reg_code ?? "",
    isSubscriber: reg.is_subscriber,
    transactionId: pay.transactionId,
  };
  try {
    const mail = courseShufraPaymentEmail(details);
    await sendEmail({ to: courseShufraEmail(), subject: mail.subject, html: mail.html });
  } catch {
    /* best-effort */
  }
  try {
    const mail = coursePaidTeamEmail({ ...details, shufraEmail: courseShufraEmail(), matchedBy: MATCHED_BY_HE[by] });
    await sendEmail({ to: courseNotifyEmail(), subject: mail.subject, html: mail.html });
  } catch {
    /* best-effort */
  }
  await sendCourseConfirmationOnce(reg);
  return already ? "paid_again" : "paid";
}

export async function recordCoursePayment(params: Record<string, string>): Promise<CoursePaymentResult> {
  const admin = createAdminClient();
  const amountAgorot = agorot(params.Amount);
  const installments = int(params.Tashloumim ?? params.Tashlumim) ?? 1;
  const firstInstallment = agorot(params.FirstTashloum);
  const name = params.ClientName?.trim() || [params.FirstName, params.LastName].filter(Boolean).join(" ").trim() || null;
  const email = params.Mail?.trim().toLowerCase() || params.Email?.trim().toLowerCase() || null;
  const phone = params.Phone?.trim() || null;
  const groupe = params.Groupe?.trim() || null;
  const comments = (params.Comments ?? params.Comment ?? "").trim() || null;
  const txId = params.TransactionId?.trim() || params.ID?.trim() || (params.KevaId?.trim() ? `keva-${params.KevaId.trim()}` : null);

  const { reg, by } = await findRegistration(params);
  const { effectiveAmountOverride } = await import("@/lib/course-settings");
  const looksLikeCourse =
    !!reg || (!!groupe && courseNedarimGroups().includes(groupe)) || isCourseAmount(amountAgorot, await effectiveAmountOverride());

  // A refused charge (Status:Error + Message) - documented only when it names
  // one of our registrants; Shufra's other refusals are not our business.
  if (params.Status === "Error" && params.Message) {
    if (!reg) return { outcome: "failure_ignored" };
    const message = String(params.Message).slice(0, 300);
    const syntheticId = `fail-${reg.id}-${(params.ErrorTime ?? "").trim() || Date.now()}`;
    const { error } = await admin.from("course_payments").insert({
      course_key: COURSE_KEY,
      registration_id: reg.id,
      transaction_id: syntheticId,
      amount_agorot: amountAgorot,
      installments,
      client_name: name,
      email,
      phone,
      groupe,
      comments,
      matched_by: by,
      status: "failed",
      raw: params as unknown as Json,
    });
    if (error && /duplicate|unique/i.test(error.message)) return { outcome: "duplicate", registrationId: reg.id, transactionId: syntheticId };
    await raiseAlert({
      kind: "course_charge_failed",
      severity: "warning",
      title: `חיוב לקורס נכשל אצל נדרים של שופרא: ${reg.full_name}`,
      body: `${reg.email}${reg.phone ? ` · ${reg.phone}` : ""} · נדרים דיווחו סירוב: "${message}"${amountAgorot ? ` · ${amountAgorot / 100} ₪` : ""}. ההרשמה לא שונתה - כדאי לפנות אליה.`,
      context: { params, registrationId: reg.id },
      dedupeKey: `course-fail:${syntheticId}`,
    });
    return { outcome: "failure_noted", registrationId: reg.id, matchedBy: by };
  }

  if (!looksLikeCourse) return { outcome: "ignored_unrelated" };

  if (!txId) {
    await raiseAlert({
      kind: "course_payment_incomplete",
      severity: "warning",
      title: `דיווח תשלום לקורס בלי אסמכתא: ${name ?? email ?? "ללא שם"}`,
      body: "הדיווח מנדרים של שופרא הגיע בלי מספר עסקה, אז לא נרשם. כדאי להצליב מול דוח נדרים של שופרא.",
      context: { params },
      dedupeKey: `course-incomplete:${email ?? name ?? "?"}:${amountAgorot ?? 0}`,
    });
    return { outcome: "incomplete", registrationId: reg?.id };
  }

  const { error } = await admin.from("course_payments").insert({
    course_key: COURSE_KEY,
    registration_id: reg?.id ?? null,
    transaction_id: txId,
    amount_agorot: amountAgorot,
    installments,
    first_installment_agorot: firstInstallment,
    client_name: name,
    email,
    phone,
    groupe,
    comments,
    matched_by: by,
    status: "ok",
    raw: params as unknown as Json,
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { outcome: "duplicate", transactionId: txId, registrationId: reg?.id };
    throw error;
  }

  if (!reg) {
    const nis = new Intl.NumberFormat("he-IL").format((amountAgorot ?? 0) / 100);
    await raiseAlert({
      kind: "course_payment_unmatched",
      severity: "warning",
      title: `תשלום לקורס בלי הרשמה תואמת: ${name ?? email ?? "ללא שם"} · ${nis} ₪`,
      body: `הגיע מנדרים של שופרא${groupe ? ` (קבוצה ״${groupe}״)` : ""}${installments > 1 ? ` ב-${installments} תשלומים` : ""}, אבל לא נמצאה הרשמה עם הקוד או המייל${email ? ` ${email}` : ""}. במסך הנרשמות אפשר לשייך אותו להרשמה. אסמכתא ${txId}.`,
      context: { transactionId: txId, params },
      dedupeKey: `course-unmatched:${txId}`,
    });
    try {
      const mail = courseUnmatchedPaymentEmail({ name, email, phone, amountAgorot: amountAgorot ?? 0, installments, groupe, transactionId: txId });
      await sendEmail({ to: courseNotifyEmail(), subject: mail.subject, html: mail.html });
    } catch {
      /* best-effort */
    }
    return { outcome: "unmatched_stored", transactionId: txId };
  }

  const outcome = await markRegistrationPaid(reg, { transactionId: txId, amountAgorot, installments, phone }, by ?? "email");
  return { outcome, registrationId: reg.id, transactionId: txId, matchedBy: by };
}
