"use server";

import { revalidatePath } from "next/cache";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { challengeByKey } from "@/lib/hackathon";

/**
 * Register to a challenge - alone or as a pair (the owner, 5/10). One row per
 * member; a pair is two rows pointing at each other. Registering again
 * replaces the previous choice; a dropped partner keeps her own registration
 * (now solo).
 */
export async function registerForHackathon(input: { challengeKey: string; partnerId: string | null }): Promise<{ error?: string }> {
  const me = await requireCommunityAccess();
  if (!isSubscriber(me)) return { error: "ההרשמה להאקתון למנויות הקהילה." };
  const challenge = challengeByKey(input.challengeKey);
  if (!challenge || !challenge.challenge) return { error: "האתגר הזה עדיין לא פתוח להרשמה." };
  const partnerId = input.partnerId?.trim() || null;
  if (partnerId === me.id) return { error: "זוג זה שתי חברות - בחרי חברה אחרת." };

  const admin = createAdminClient();
  if (partnerId) {
    const { data: partner } = await admin
      .from("profiles")
      .select("id, status, member_tier, role")
      .eq("id", partnerId)
      .maybeSingle();
    if (!partner || partner.status !== "active" || partner.member_tier !== "paid" || partner.role !== "junior") {
      return { error: "אפשר להירשם כזוג רק עם מנויה פעילה בקהילה." };
    }
  }

  const now = new Date().toISOString();
  const { data: mine } = await admin.from("hackathon_registrations").select("partner_profile_id").eq("profile_id", me.id).maybeSingle();
  const previousPartner = mine?.partner_profile_id ?? null;

  // My row.
  const { error } = await admin
    .from("hackathon_registrations")
    .upsert({ profile_id: me.id, challenge_key: challenge.key!, partner_profile_id: partnerId, updated_at: now }, { onConflict: "profile_id" });
  if (error) return { error: "ההרשמה לא נשמרה. נסי שוב בעוד רגע." };

  // The partner I left (if any) stays registered, solo.
  if (previousPartner && previousPartner !== partnerId) {
    await admin.from("hackathon_registrations").update({ partner_profile_id: null, updated_at: now }).eq("profile_id", previousPartner).eq("partner_profile_id", me.id);
  }
  // My new partner joins me on this challenge (her old partner, if any, becomes solo).
  if (partnerId) {
    const { data: theirs } = await admin.from("hackathon_registrations").select("partner_profile_id").eq("profile_id", partnerId).maybeSingle();
    const theirOld = theirs?.partner_profile_id ?? null;
    if (theirOld && theirOld !== me.id) {
      await admin.from("hackathon_registrations").update({ partner_profile_id: null, updated_at: now }).eq("profile_id", theirOld).eq("partner_profile_id", partnerId);
    }
    await admin
      .from("hackathon_registrations")
      .upsert({ profile_id: partnerId, challenge_key: challenge.key!, partner_profile_id: me.id, updated_at: now }, { onConflict: "profile_id" });
  }

  revalidatePath("/hackathon");
  revalidatePath(`/hackathon/${challenge.key}`);
  revalidatePath("/admin/hackathon");
  return {};
}

/** Leave the hackathon; a partner stays registered on her own. */
export async function cancelHackathonRegistration(): Promise<{ error?: string }> {
  const me = await requireCommunityAccess();
  const admin = createAdminClient();
  const { data: mine } = await admin.from("hackathon_registrations").select("partner_profile_id").eq("profile_id", me.id).maybeSingle();
  if (mine?.partner_profile_id) {
    await admin
      .from("hackathon_registrations")
      .update({ partner_profile_id: null, updated_at: new Date().toISOString() })
      .eq("profile_id", mine.partner_profile_id)
      .eq("partner_profile_id", me.id);
  }
  const { error } = await admin.from("hackathon_registrations").delete().eq("profile_id", me.id);
  if (error) return { error: "הביטול לא נשמר. נסי שוב." };
  revalidatePath("/hackathon");
  revalidatePath("/admin/hackathon");
  return {};
}
