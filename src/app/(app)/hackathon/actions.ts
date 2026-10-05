"use server";

import { revalidatePath } from "next/cache";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend";
import { hackathonPairInviteEmail } from "@/lib/email/templates";
import { challengeByKey } from "@/lib/hackathon";

type Admin = ReturnType<typeof createAdminClient>;

/** A pair is two rows pointing at each other; this clears one side. */
async function unlinkPartner(admin: Admin, profileId: string, fromPartnerId: string) {
  await admin
    .from("hackathon_registrations")
    .update({ partner_profile_id: null, partner_confirmed_at: null, updated_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("partner_profile_id", fromPartnerId);
}

function revalidate(challengeKey?: string) {
  revalidatePath("/hackathon");
  if (challengeKey) revalidatePath(`/hackathon/${challengeKey}`);
  revalidatePath("/admin/hackathon");
}

/**
 * Register to a challenge - alone, or as a pair (the owner, 5/10). A pair
 * starts as an INVITATION: my row names her, she gets an email, and only her
 * confirmation writes her own row. Registering again replaces my choice; a
 * partner I drop keeps her registration, now solo.
 */
export async function registerForHackathon(input: { challengeKey: string; partnerId: string | null }): Promise<{ error?: string; invited?: boolean }> {
  const me = await requireCommunityAccess();
  if (!isSubscriber(me)) return { error: "ההרשמה להאקתון למנויות הקהילה." };
  const challenge = challengeByKey(input.challengeKey);
  if (!challenge || !challenge.challenge) return { error: "האתגר הזה עדיין לא פתוח להרשמה." };
  const partnerId = input.partnerId?.trim() || null;
  if (partnerId === me.id) return { error: "זוג זה שתי חברות - בחרי חברה אחרת." };

  const admin = createAdminClient();
  let partnerName: string | null = null;
  if (partnerId) {
    const { data: partner } = await admin
      .from("profiles")
      .select("id, full_name, status, member_tier, role")
      .eq("id", partnerId)
      .maybeSingle();
    if (!partner || partner.status !== "active" || partner.member_tier !== "paid" || partner.role !== "junior") {
      return { error: "אפשר להירשם כזוג רק עם מנויה פעילה בקהילה." };
    }
    partnerName = partner.full_name;
  }

  const now = new Date().toISOString();
  const { data: mine } = await admin
    .from("hackathon_registrations")
    .select("partner_profile_id, partner_confirmed_at, challenge_key")
    .eq("profile_id", me.id)
    .maybeSingle();
  const previousPartner = mine?.partner_profile_id ?? null;
  // Same partner, already confirmed, only the challenge changed (or nothing):
  // keep the confirmation - she agreed to be MY pair, the pair moves together.
  const samePartner = !!partnerId && previousPartner === partnerId;
  const keepConfirmation = samePartner && !!mine?.partner_confirmed_at;

  const { error } = await admin.from("hackathon_registrations").upsert(
    {
      profile_id: me.id,
      challenge_key: challenge.key!,
      partner_profile_id: partnerId,
      partner_confirmed_at: keepConfirmation ? mine!.partner_confirmed_at : null,
      updated_at: now,
    },
    { onConflict: "profile_id" }
  );
  if (error) return { error: "ההרשמה לא נשמרה. נסי שוב בעוד רגע." };

  // The partner I left stays registered, solo.
  if (previousPartner && previousPartner !== partnerId) await unlinkPartner(admin, previousPartner, me.id);

  // A confirmed pair moves to the new challenge together.
  if (keepConfirmation && partnerId) {
    await admin
      .from("hackathon_registrations")
      .update({ challenge_key: challenge.key!, updated_at: now })
      .eq("profile_id", partnerId)
      .eq("partner_profile_id", me.id);
  }

  // A new invitation: tell her by email; her row is written when she confirms.
  let invited = false;
  if (partnerId && !keepConfirmation) {
    invited = true;
    try {
      const { data: rows } = await admin.rpc("member_emails", { p_ids: [partnerId] });
      const email = ((rows ?? []) as { id: string; email: string | null }[])[0]?.email;
      if (email) {
        const first = partnerName?.split(/\s+/)[0] || undefined;
        const built = hackathonPairInviteEmail(first, me.full_name, challenge.short);
        const sent = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
        if (!sent.ok) console.error("[hackathon invite email] send failed:", sent.error);
      }
    } catch (e) {
      console.error("[hackathon invite email] failed:", e);
    }
  }

  revalidate(challenge.key);
  return { invited };
}

/** She confirms an invitation: joins the inviter's challenge as her pair. */
export async function confirmPairInvite(inviterId: string): Promise<{ error?: string }> {
  const me = await requireCommunityAccess();
  if (!isSubscriber(me)) return { error: "ההרשמה להאקתון למנויות הקהילה." };
  const admin = createAdminClient();
  const { data: inviter } = await admin
    .from("hackathon_registrations")
    .select("challenge_key, partner_profile_id, partner_confirmed_at")
    .eq("profile_id", inviterId)
    .maybeSingle();
  if (!inviter || inviter.partner_profile_id !== me.id) return { error: "ההזמנה הזו כבר לא בתוקף." };
  const now = new Date().toISOString();
  // My old pair (if any) becomes solo.
  const { data: mine } = await admin.from("hackathon_registrations").select("partner_profile_id").eq("profile_id", me.id).maybeSingle();
  if (mine?.partner_profile_id && mine.partner_profile_id !== inviterId) await unlinkPartner(admin, mine.partner_profile_id, me.id);
  const { error } = await admin.from("hackathon_registrations").upsert(
    { profile_id: me.id, challenge_key: inviter.challenge_key, partner_profile_id: inviterId, partner_confirmed_at: now, updated_at: now },
    { onConflict: "profile_id" }
  );
  if (error) return { error: "האישור לא נשמר. נסי שוב." };
  await admin.from("hackathon_registrations").update({ partner_confirmed_at: now, updated_at: now }).eq("profile_id", inviterId);
  revalidate(inviter.challenge_key);
  return {};
}

/** She declines: the inviter stays registered, solo. */
export async function declinePairInvite(inviterId: string): Promise<{ error?: string }> {
  const me = await requireCommunityAccess();
  const admin = createAdminClient();
  await unlinkPartner(admin, inviterId, me.id);
  revalidate();
  return {};
}

/** Leave the hackathon; a partner stays registered on her own. */
export async function cancelHackathonRegistration(): Promise<{ error?: string }> {
  const me = await requireCommunityAccess();
  const admin = createAdminClient();
  const { data: mine } = await admin.from("hackathon_registrations").select("partner_profile_id").eq("profile_id", me.id).maybeSingle();
  if (mine?.partner_profile_id) await unlinkPartner(admin, mine.partner_profile_id, me.id);
  const { error } = await admin.from("hackathon_registrations").delete().eq("profile_id", me.id);
  if (error) return { error: "הביטול לא נשמר. נסי שוב." };
  revalidate();
  return {};
}
