import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyEmailChange } from "@/lib/email-change";

export const dynamic = "force-dynamic";

/**
 * The link in the "אישור הכתובת החדשה" mail. A valid, unexpired token applies
 * the change the team prepared (the address is re-checked for being taken at
 * click time) and sends her to log in with the new address.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const change = token ? verifyEmailChange(token) : null;
  if (!change) return NextResponse.redirect(`${origin}/login?error=email_change`);

  const admin = createAdminClient();
  const { data: owner } = await admin.rpc("auth_user_id_by_email", { p_email: change.newEmail });
  if (owner && owner !== change.profileId) return NextResponse.redirect(`${origin}/login?error=email_change_taken`);
  const { data: current } = await admin.auth.admin.getUserById(change.profileId);
  if (!current?.user) return NextResponse.redirect(`${origin}/login?error=email_change`);
  if ((current.user.email ?? "").toLowerCase() !== change.newEmail) {
    const { error } = await admin.auth.admin.updateUserById(change.profileId, { email: change.newEmail, email_confirm: true });
    if (error) return NextResponse.redirect(`${origin}/login?error=email_change`);
  }
  return NextResponse.redirect(`${origin}/login?notice=email_changed`);
}
