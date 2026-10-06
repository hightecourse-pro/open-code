import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The annual "מאסטרית בהייטק" course (Shufra × Open Code × Hightcourse),
 * sold on the public page /masters-course (the owner, 25/9).
 *
 * Money: the clearing is Shufra's own Nedarim account (mosad 7009686), not
 * ours - so no payment callback ever reaches this app. We register the woman,
 * tell the team, and hand her over to Shufra's payment page. "Paid" is then
 * confirmed by the team on /admin/course-registrations.
 */
export const COURSE_KEY = "masters-2026";
export const COURSE_TITLE = "מאסטרית בהייטק";
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
 * Shufra's Nedarim payment page for the course (the owner, 6/10:
 * https://nedar.im/cSpv). The short link is a saved configuration on their
 * mosad: 1,500 ₪ locked, 12 payments, group "שימור מקצועי הנדסת תוכנה" - the
 * subscriber price. The long form is used because it takes extra URL
 * parameters (the short one drops them on its redirect).
 * COURSE_PAYMENT_URL (Vercel env) overrides it.
 */
export function coursePaymentUrl(): string {
  return process.env.COURSE_PAYMENT_URL?.trim() || "https://www.matara.pro/nedarimplus/online/?S=cSpv";
}

/** Without the subscriber scholarship there is no saved link yet - the mosad's open page. */
export function coursePaymentUrlFull(): string {
  return process.env.COURSE_PAYMENT_URL_FULL?.trim() || `https://www.matara.pro/nedarimplus/online/?mosad=${SHUFRA_MOSAD_ID}`;
}

export interface PaymentLinkInput {
  subscriber: boolean;
  fullName: string;
  email: string;
  phone: string;
  regCode: string;
  payToken: string;
  siteUrl: string;
}

/**
 * No callback is possible on someone else's mosad - but their payment page
 * reads URL parameters (verified against the page's own script, 6/10):
 *   ClientName / Email / Phone - prefilled, so the payment carries the same
 *                                details as the registration;
 *   Analytic  - prefixed to the payment's comment: our registration code
 *               shows up in Shufra's Nedarim report next to the charge;
 *   Redirect  - after a SUCCESSFUL charge the page sends her browser there:
 *               our /masters-course/paid?r=<token> marks "reported as paid".
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

export interface MembershipLookup {
  profileId: string | null;
  /** Active account on the paid tier right now - the scholarship condition. */
  isSubscriber: boolean;
  firstName: string | null;
  status: string | null;
  tier: string | null;
  role: string | null;
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

/** Is this email an Open Code subscriber? Service role: auth.users → profiles. */
export async function lookupMembership(email: string): Promise<MembershipLookup> {
  const admin = createAdminClient();
  const none: MembershipLookup = { profileId: null, isSubscriber: false, firstName: null, status: null, tier: null, role: null };
  const { data: uid } = await admin.rpc("auth_user_id_by_email", { p_email: email });
  if (!uid) return none;
  const { data: p } = await admin
    .from("profiles")
    .select("id, full_name, first_name, status, member_tier, role")
    .eq("id", uid as string)
    .maybeSingle();
  if (!p) return none;
  const firstName = p.first_name || p.full_name?.split(/\s+/)[0] || null;
  return {
    profileId: p.id,
    isSubscriber: p.status === "active" && p.member_tier === "paid",
    firstName,
    status: p.status,
    tier: p.member_tier,
    role: p.role,
  };
}
