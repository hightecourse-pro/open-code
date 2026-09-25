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
 * Where "ממשיכה לתשלום" sends her. COURSE_PAYMENT_URL (Vercel env) wins;
 * the fallback is Nedarim Plus's public payment page for Shufra's mosad.
 */
export function coursePaymentUrl(): string {
  return process.env.COURSE_PAYMENT_URL?.trim() || `https://www.matara.pro/nedarimplus/online/?mosad=${SHUFRA_MOSAD_ID}`;
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
