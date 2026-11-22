import "server-only";
import { getProfile, hasHcAccess } from "@/lib/auth";
import type { Profile } from "@/types/database";
import { HcLogin, HcNotAdmin } from "./gate";

/*
  The gate every management screen passes: signed out → the sign-in; a
  signed-in account without access → told so; an admin, or an account with the
  hc_access flag → every screen. Same Supabase auth as Open Code (the owner,
  18/11: ״עם אותו שם ומשתמש וסיסמא של האדמינים בקוד פתוח״); the flag came on
  22/11 (the owner: ״תן לי ליהודית משתמש וסיסמה רק לדשבורד, לא לאדמין של קוד
  פתוח״ and then ״תפתח לה כל מה שקשור להייטקורס״).
*/
export async function hcGate(): Promise<{ profile: Profile | null; allowed: boolean }> {
  const profile = await getProfile().catch(() => null);
  return { profile, allowed: hasHcAccess(profile) };
}

/** What a screen shows instead of itself: the sign-in, or ״בלי הרשאה״. */
export function GateView({ profile }: { profile: Profile | null }) {
  return profile ? <HcNotAdmin name={profile.first_name || profile.full_name || ""} /> : <HcLogin />;
}
