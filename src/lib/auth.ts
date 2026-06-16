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
 * Gate community content: must be signed in AND approved/active.
 * Pending/paused/rejected members get the warm upsell on /join.
 * (RLS is the real enforcement — this is the UX layer.)
 */
export async function requireActiveAccess(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.status !== "active") {
    redirect(`/join?status=${profile.status}`);
  }
  return profile;
}

/** Require a specific role; non-matching users are sent back to the feed. */
export async function requireRole(role: UserRole): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== role) redirect("/feed");
  return profile;
}
