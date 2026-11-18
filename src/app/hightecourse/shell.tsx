import "server-only";
import { getProfile } from "@/lib/auth";
import type { Profile } from "@/types/database";
import { HcLogin, HcNotAdmin } from "./gate";

/*
  The gate every management screen passes: signed out → the sign-in; a
  signed-in non-admin → told so; an admin → the screen. Same Supabase auth and
  the same admin role as Open Code (the owner, 18/11: ״עם אותו שם ומשתמש
  וסיסמא של האדמינים בקוד פתוח״).
*/
export async function hcGate(): Promise<{ profile: Profile | null; isAdmin: boolean }> {
  const profile = await getProfile().catch(() => null);
  return { profile, isAdmin: profile?.role === "admin" };
}

export function GateView({ profile }: { profile: Profile | null }) {
  return profile ? <HcNotAdmin name={profile.first_name || profile.full_name || ""} /> : <HcLogin />;
}
