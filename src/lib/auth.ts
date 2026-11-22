import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

/**
 * The authenticated Supabase user, or null. Validates the token server-side.
 *
 * Wrapped in React's cache() so one request validates the token ONCE, no
 * matter how many of layout / page / generateMetadata / helpers ask - each
 * auth.getUser() here is a real network round trip to Supabase Auth.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The current user's profile row (role, status, tier…), or null if signed out.
 * cache()d like getUser: the layout and the page it wraps share one profiles
 * row per request instead of fetching it twice.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data ?? null;
});

/** Redirect to /login unless signed in. Returns the profile. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * True for a paying member - the tier that can take part rather than just
 * look around (join links, recordings, posting, courses, AI, mentor chat).
 */
export function isSubscriber(profile: Pick<Profile, "status" | "role">): boolean {
  return profile.status === "active" || profile.role === "admin";
}

/**
 * May she use what belongs to Hightecourse - מערכת ניהול הייטקורס
 * (/hightecourse, every screen), the tags desk, the AI-course admin? Every
 * admin, plus an account given the hc_access flag alone (the owner, 22/11: ״תן
 * לי ליהודית משתמש וסיסמה רק לדשבורד, לא לאדמין של קוד פתוח״, then ״תפתח לה
 * כל מה שקשור להייטקורס״) - that account is never an admin here and never a
 * member of the community.
 */
export function hasHcAccess(profile: Pick<Profile, "role" | "hc_access"> | null | undefined): boolean {
  return !!profile && (profile.role === "admin" || profile.hc_access === true);
}

/** A Hightecourse-only account: the flag without membership - the community is not hers. */
export function isHcOnly(profile: Pick<Profile, "role" | "hc_access" | "status">): boolean {
  return profile.hc_access === true && profile.role !== "admin" && profile.status === "pending";
}

/**
 * Gate the community: anyone signed in may come in and look around. Paying
 * is what unlocks taking part - enforced per feature, not at the door.
 * Only a rejected member is turned away.
 * (RLS is the real enforcement - this is the UX layer.)
 */
export async function requireCommunityAccess(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.status === "left") redirect("/left");
  // A Hightecourse-only account (22/11) has no community - its screens are /hightecourse.
  if (isHcOnly(profile)) redirect("/hightecourse");
  if (profile.status === "rejected") {
    redirect(`/join?status=${profile.status}`);
  }
  return profile;
}

/**
 * Gate a paid feature by redirecting. Most screens instead render an upgrade
 * card in place, which reads better than bouncing her out of the community.
 */
export async function requireSubscription(feature: string): Promise<Profile> {
  const profile = await requireCommunityAccess();
  if (!isSubscriber(profile)) {
    redirect(`/join?locked=${encodeURIComponent(feature)}`);
  }
  return profile;
}

/** Require Hightecourse access (an admin or an hc_access account); others are sent back to the feed. */
export async function requireHcAccess(): Promise<Profile> {
  const profile = await requireProfile();
  if (!hasHcAccess(profile)) redirect("/forum");
  return profile;
}

/** Require a specific role; non-matching users are sent back to the feed. */
export async function requireRole(role: UserRole): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== role) redirect("/forum");
  return profile;
}
