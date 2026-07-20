import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

/** The authenticated Supabase user, or null. Validates the token server-side. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The current user's profile row (role, status, tier…), or null if signed out. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data ?? null;
}

/** Redirect to /login unless signed in. Returns the profile. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * True for a paying member — the tier that can take part rather than just
 * look around (join links, recordings, posting, courses, AI, mentor chat).
 */
export function isSubscriber(profile: Pick<Profile, "status" | "role">): boolean {
  return profile.status === "active" || profile.role === "admin";
}

/**
 * Gate the community: anyone signed in may come in and look around. Paying
 * is what unlocks taking part — enforced per feature, not at the door.
 * Only a rejected member is turned away.
 * (RLS is the real enforcement — this is the UX layer.)
 */
export async function requireCommunityAccess(): Promise<Profile> {
  const profile = await requireProfile();
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

/** Require a specific role; non-matching users are sent back to the feed. */
export async function requireRole(role: UserRole): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== role) redirect("/forum");
  return profile;
}
