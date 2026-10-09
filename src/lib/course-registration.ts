import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The annual "מאסטרית בהייטק" course (Shufra × Open Code × Hightcourse),
 * sold on the public page /masters-course (the owner, 25/9).
 *
 * Money: the clearing is Shufra's own Nedarim account (mosad 7009686), not
 * ours. We register the woman, tell the team, and hand her over to Shufra's
 * payment page with her registration code in the payment comment. Since 9/10
 * Shufra's account calls our CallBack (/api/webhooks/course-payments), which
 * matches the payment back to her; the browser redirect to /masters-course/paid
 * remains the fallback signal ("reported as paid", verified by the team).
 *
 * Prices, links and the pure helpers live in course-links.ts (testable
 * without a server); this file adds what needs the database.
 */
export * from "./course-links";

export const COURSE_KEY = "masters-2026";
export const COURSE_TITLE = "מאסטרית בהייטק";

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
