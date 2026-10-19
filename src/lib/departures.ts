import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_EMAILS } from "@/lib/email-prefs";
import { normalizeEmail } from "@/lib/unsubscribe";

/**
 * What "stop my mails" and "I am leaving" do to the data (the owner, 18/10).
 * Server-only on purpose: the public page's action and the profile's action
 * call these after they have verified who is asking.
 */

export async function profileIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("auth_user_id_by_email", { p_email: normalizeEmail(email) });
  return (data as string | null) ?? null;
}

/** Stop our mails to this address (member or not); a member's preference follows. */
export async function stopEmailsFor(email: string, reason: string): Promise<void> {
  const admin = createAdminClient();
  const e = normalizeEmail(email);
  const profileId = await profileIdByEmail(e);
  await admin.from("email_opt_outs").upsert({ email: e, kind: "emails", reason: reason || null, profile_id: profileId }, { onConflict: "email" });
  if (profileId) await admin.from("profiles").update({ digest_frequency: NO_EMAILS }).eq("id", profileId);
}

/**
 * She leaves the community: status 'left' (the previous status remembered for
 * the way back), the reason kept, no more mail, off the employer portal. The
 * account itself stays - the team can still see her and act on a subscription.
 */
export async function leaveCommunityFor(reason: string, who: { email?: string | null; profileId?: string | null }): Promise<boolean> {
  const admin = createAdminClient();
  const email = who.email ? normalizeEmail(who.email) : null;
  const profileId = who.profileId ?? (email ? await profileIdByEmail(email) : null);
  if (!profileId) return false;
  const { data: p } = await admin.from("profiles").select("status, role").eq("id", profileId).maybeSingle();
  if (!p || p.role === "admin") return false;
  if (p.status !== "left") {
    await admin
      .from("profiles")
      .update({ status: "left", left_at: new Date().toISOString(), left_reason: reason || null, left_from_status: p.status, digest_frequency: NO_EMAILS, portal_listed: false })
      .eq("id", profileId);
  }
  if (email) await admin.from("email_opt_outs").upsert({ email, kind: "left", reason: reason || null, profile_id: profileId }, { onConflict: "email" });
  return true;
}
