"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { raiseAlert } from "@/lib/alerts";
import { sendEmail } from "@/lib/email/send";
import { courseRegistrationEmail } from "@/lib/email/templates";
import {
  COURSE_KEY,
  coursePaymentUrl,
  courseNotifyEmail,
  lookupMembership,
  normalizeEmail,
} from "@/lib/course-registration";

export type CourseEmailCheck =
  | { ok: true; subscriber: boolean; firstName: string | null; known: boolean }
  | { ok: false; error: string };

/**
 * Step 1 of the registration: "מי שרוצה להרשם מכניסה מייל ואתה בודק אם היא
 * מנויה בקוד פתוח". Only says subscriber / not - nothing else about the account.
 */
export async function checkCourseEmail(emailRaw: string): Promise<CourseEmailCheck> {
  const email = normalizeEmail(emailRaw ?? "");
  if (!email) return { ok: false, error: "הכתובת לא נראית תקינה - בדקי אותה שוב." };
  const m = await lookupMembership(email);
  return { ok: true, subscriber: m.isSubscriber, firstName: m.isSubscriber ? m.firstName : null, known: !!m.profileId };
}

export interface RegisterCourseInput {
  email: string;
  fullName: string;
  phone: string;
  /** "join" = she chose to open a membership first; "pay" = straight to payment. */
  intent: "pay" | "join";
  /** Honeypot - real people leave it empty. */
  website?: string;
}

export type RegisterCourseResult =
  | { ok: true; paymentUrl: string; subscriber: boolean; joinUrl: string }
  | { ok: false; error: string };

/**
 * Step 2: record her, tell the team, hand her to Shufra's Nedarim page.
 * A second submit with the same email updates the row instead of duplicating.
 */
export async function registerForCourse(input: RegisterCourseInput): Promise<RegisterCourseResult> {
  if (input.website) return { ok: true, paymentUrl: coursePaymentUrl(), subscriber: false, joinUrl: "/signup" };
  const email = normalizeEmail(input.email ?? "");
  if (!email) return { ok: false, error: "הכתובת לא נראית תקינה - בדקי אותה שוב." };
  const fullName = (input.fullName ?? "").trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 80) return { ok: false, error: "איך קוראים לך? שם מלא בבקשה." };
  const phoneDigits = (input.phone ?? "").replace(/\D/g, "");
  if (!/^0\d{8,9}$/.test(phoneDigits)) return { ok: false, error: "מספר טלפון לא תקין (למשל 052-1234567)." };
  const intent = input.intent === "join" ? "join" : "pay";

  const m = await lookupMembership(email);
  const membershipNote = m.profileId
    ? `חשבון בקהילה: ${m.status ?? "?"} / ${m.tier ?? "?"} / ${m.role ?? "?"}${intent === "join" ? " · ביקשה להצטרף למנוי" : ""}`
    : intent === "join"
      ? "אין חשבון בקהילה · ביקשה להצטרף למנוי"
      : "אין חשבון בקהילה";

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("course_registrations")
    .select("id")
    .eq("course_key", COURSE_KEY)
    .ilike("email", email)
    .maybeSingle();

  const row = {
    course_key: COURSE_KEY,
    email,
    full_name: fullName,
    phone: phoneDigits,
    profile_id: m.profileId,
    is_subscriber: m.isSubscriber,
    membership_note: membershipNote,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await admin.from("course_registrations").update(row).eq("id", existing.id)
    : await admin.from("course_registrations").insert(row);
  if (error) return { ok: false, error: "לא הצלחנו לשמור את ההרשמה. נסי שוב בעוד רגע, או כתבי לנו ל-office@opencode.org.il." };

  // The team hears about every registration - an alert in the admin and a
  // mail to the office. A repeat submit does not shout twice.
  if (!existing) {
    try {
      await raiseAlert({
        kind: "course_registration",
        severity: "info",
        title: `נרשמה לקורס מאסטרית: ${fullName}`,
        body: `${email} · ${phoneDigits} · ${m.isSubscriber ? "מנויה ✓" : "לא מנויה"} · ${membershipNote}`,
        dedupeKey: `course_registration:${COURSE_KEY}:${email}`,
      });
    } catch {
      /* the registration is saved; the alert is best-effort */
    }
    try {
      const mail = courseRegistrationEmail({ fullName, email, phone: phoneDigits, isSubscriber: m.isSubscriber, membershipNote });
      await sendEmail({ to: courseNotifyEmail(), subject: mail.subject, html: mail.html });
    } catch {
      /* same - never block her on our mail */
    }
  }

  return { ok: true, paymentUrl: coursePaymentUrl(), subscriber: m.isSubscriber, joinUrl: m.profileId ? "/join" : "/signup" };
}
