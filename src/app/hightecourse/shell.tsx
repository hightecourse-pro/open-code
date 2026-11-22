import "server-only";
import { getProfile, hasHcAccess } from "@/lib/auth";
import type { Profile } from "@/types/database";
import { HcAdminOnly, HcLogin, HcNotAdmin } from "./gate";

/*
  The gate every management screen passes: signed out → the sign-in; a
  signed-in account without access → told so; an admin → every screen. Same
  Supabase auth and the same admin role as Open Code (the owner, 18/11: ״עם
  אותו שם ומשתמש וסיסמא של האדמינים בקוד פתוח״). Since 22/11 an account may
  carry the hc_access flag instead of the admin role (the owner: ״תן לי ליהודית
  משתמש וסיסמה רק לדשבורד, לא לאדמין של קוד פתוח״): it gets the dashboard and
  the participants; the sheets and the pre-conference mail stay with admins.
*/
export async function hcGate(): Promise<{ profile: Profile | null; allowed: boolean; isAdmin: boolean }> {
  const profile = await getProfile().catch(() => null);
  return { profile, allowed: hasHcAccess(profile), isAdmin: profile?.role === "admin" };
}

/** What a screen shows instead of itself: the sign-in, ״בלי הרשאה״, or - on an admins-only screen - ״למנהלות קוד פתוח בלבד״. */
export function GateView({ profile, adminOnly = false }: { profile: Profile | null; adminOnly?: boolean }) {
  if (!profile) return <HcLogin />;
  if (adminOnly && hasHcAccess(profile)) return <HcAdminOnly />;
  return <HcNotAdmin name={profile.first_name || profile.full_name || ""} />;
}
