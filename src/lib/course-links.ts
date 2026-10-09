/**
 * The annual "מאסטרית בהייטק" course - prices, Shufra's payment pages and the
 * pure helpers around them. No server imports here, so a Node test can load
 * this file directly; course-registration.ts re-exports everything.
 */
export const SHUFRA_MOSAD_ID = "7009686";

/** The price ladder the ad shows, in whole shekels. */
export const COURSE_PRICE = {
  full: 12000,
  shufraFunding: 6000,
  subscriberScholarship: 4500,
  /** What a subscriber pays: 12 × 125. */
  subscriberTotal: 1500,
  subscriberMonthly: 125,
  installments: 12,
  /** Without the subscriber scholarship: full minus Shufra's funding. */
  nonSubscriberTotal: 6000,
} as const;

/** Membership price used in the "join first" offer (₪ per month). */
export const MEMBERSHIP_MONTHLY = 39;

/**
 * Shufra's saved Nedarim pages for the course (the owner, 6/10 and 9/10):
 *   https://nedar.im/cSpv - subscribers: 1,500 ₪ locked, 12 payments,
 *                           group "שימור מקצועי הנדסת תוכנה";
 *   https://nedar.im/dvRk - no scholarship: 6,000 ₪ (not locked), 12 payments,
 *                           group "שימור מקצועי הנדסת תוכנה ללא קוד פתוח".
 * The long form is used because it takes extra URL parameters (the short one
 * drops them on its redirect). COURSE_PAYMENT_URL / COURSE_PAYMENT_URL_FULL
 * (Vercel env) override.
 */
export function coursePaymentUrl(): string {
  return process.env.COURSE_PAYMENT_URL?.trim() || "https://www.matara.pro/nedarimplus/online/?S=cSpv";
}

export function coursePaymentUrlFull(): string {
  return process.env.COURSE_PAYMENT_URL_FULL?.trim() || "https://www.matara.pro/nedarimplus/online/?S=dvRk";
}

/**
 * Test mode (the owner, 9/10: "לשנות בקונפיג את הסכום של הדף בשביל בדיקות"):
 * COURSE_PAYMENT_AMOUNT_OVERRIDE=<shekels> puts that amount on the payment
 * page instead of the saved one (verified 9/10: a URL Amount= wins even on a
 * page whose saved amount is locked). The admin screen shouts while it is set.
 */
export function coursePaymentAmountOverride(): number | null {
  const n = parseInt(process.env.COURSE_PAYMENT_AMOUNT_OVERRIDE?.trim() ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface PaymentLinkInput {
  subscriber: boolean;
  fullName: string;
  email: string;
  phone: string;
  regCode: string;
  payToken: string;
  siteUrl: string;
  /** Test mode set by the admin (app_settings) - wins over the env override. */
  amountOverride?: number | null;
}

/**
 * Their payment page reads URL parameters (verified against the page's own
 * script, 6/10):
 *   ClientName / Email / Phone - prefilled, so the payment carries the same
 *                                details as the registration;
 *   Analytic  - prefixed to the payment's comment: our registration code
 *               shows up in Shufra's Nedarim report next to the charge, and
 *               the CallBack matches the payment to her by it;
 *   Redirect  - after a SUCCESSFUL charge the page sends her browser there:
 *               our /masters-course/paid?r=<token>;
 *   Amount    - only in test mode (see coursePaymentAmountOverride).
 * Values are encodeURIComponent'ed (the page decodes with decodeURIComponent,
 * which does not turn "+" into a space).
 */
export function buildCoursePaymentUrl(i: PaymentLinkInput): string {
  const base = i.subscriber ? coursePaymentUrl() : coursePaymentUrlFull();
  const back = `${i.siteUrl.replace(/\/$/, "")}/masters-course/paid?r=${i.payToken}`;
  const params: [string, string][] = [
    ["ClientName", i.fullName],
    ["Email", i.email],
    ["Phone", i.phone],
    ["Analytic", i.regCode],
    ["Redirect", back],
  ];
  const override = i.amountOverride ?? coursePaymentAmountOverride();
  if (override) params.push(["Amount", String(override)]);
  const qs = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `${base}${base.includes("?") ? "&" : "?"}${qs}`;
}

/** "OC-7K3F9Q" - short enough to read over the phone, unambiguous letters. */
export function newRegCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `OC-${out}`;
}

export function newPayToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Who hears about every registration (the owner: office@ by default). */
export function courseNotifyEmail(): string {
  return process.env.COURSE_NOTIFY_EMAIL?.trim() || "office@opencode.org.il";
}

/** Shufra's inbox - gets a mail per course payment (the owner, 9/10: name + amount). */
export function courseShufraEmail(): string {
  return process.env.COURSE_SHUFRA_EMAIL?.trim() || "info@shufra.org.il";
}

// ------------------------------------------------------- Shufra's CallBack
// The owner (9/10): Shufra's Nedarim account CAN call a CallBack URL after
// every charge - but it reports all of Shufra's payments, so ours are told
// apart by the registration code we plant in the payment comment, then by
// email, and as a last resort by the saved page's group or a course amount.

/** The Nedarim mosad whose callbacks the course webhook accepts. */
export function courseMosadId(): string {
  return process.env.COURSE_NEDARIM_MOSAD_ID?.trim() || SHUFRA_MOSAD_ID;
}

/** The shared secret in the CallBack URL configured on Shufra's account. */
export function courseCallbackSecret(): string | null {
  const s = process.env.COURSE_CALLBACK_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

/** The URL the owner pastes into Shufra's Nedarim admin (null until the secret is set). */
export function courseCallbackUrl(siteUrl: string): string | null {
  const secret = courseCallbackSecret();
  if (!secret) return null;
  return `${siteUrl.replace(/\/$/, "")}/api/webhooks/course-payments?key=${encodeURIComponent(secret)}`;
}

/** The "קבוצה" of the saved payment pages - a payment in one of them is a course payment even without a code. */
export function courseNedarimGroups(): string[] {
  const env = (process.env.COURSE_NEDARIM_GROUPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return env.length ? env : ["שימור מקצועי הנדסת תוכנה", "שימור מקצועי הנדסת תוכנה ללא קוד פתוח"];
}

/** Whole-course and per-installment amounts (agorot) that read as the course even without a group - and the test amount. */
export function isCourseAmount(agorot: number | null, amountOverride?: number | null): boolean {
  if (!agorot) return false;
  const whole = [COURSE_PRICE.subscriberTotal, COURSE_PRICE.nonSubscriberTotal].map((n) => n * 100);
  const monthly = [COURSE_PRICE.subscriberMonthly * 100, Math.round((COURSE_PRICE.nonSubscriberTotal / COURSE_PRICE.installments) * 100)];
  const override = amountOverride ?? coursePaymentAmountOverride();
  return whole.includes(agorot) || monthly.includes(agorot) || (!!override && agorot === override * 100);
}

/**
 * Nedarim allows ONE webhook URL per event type, and Shufra's account already
 * has one (a Google Apps Script, 9/10 screenshot). Ours takes the slot and
 * passes every authenticated update on to theirs, unchanged, so nothing on
 * their side stops working. Declines go to their declines hook, if they have one.
 */
export function courseForwardUrl(kind: "transactions" | "declines"): string | null {
  const v = (kind === "declines" ? process.env.COURSE_CALLBACK_FORWARD_URL_DECLINES : process.env.COURSE_CALLBACK_FORWARD_URL)?.trim();
  return v && /^https:\/\//.test(v) ? v : null;
}

export const REG_CODE_RE = /OC-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}/;

/** The registration code planted in the payment comment (Analytic → Comments). */
export function findRegCode(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    const m = (t ?? "").toUpperCase().match(REG_CODE_RE);
    if (m) return m[0];
  }
  return null;
}
