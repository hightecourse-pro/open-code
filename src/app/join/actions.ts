"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isProductionEnv } from "@/lib/env";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isNedarimConfigured } from "@/lib/payments/nedarim";
import { activateSubscription } from "@/lib/payments/subscription";
import type { SubscriptionPlan } from "@/types/database";

/** Has the Nedarim CallBack activated the current member yet? (polled post-payment) */
export async function checkMembershipActive(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();
  return data?.status === "active";
}

/**
 * DEV ONLY: simulate a successful payment so the full signup → pay → active
 * flow is testable before Nedarim credentials exist. Disabled once Nedarim is
 * configured — in production the real server CallBack activates the member.
 */
export async function simulatePayment(plan: SubscriptionPlan): Promise<{ error?: string }> {
  // Hard-blocked in production regardless of env state: the real Nedarim
  // CallBack is the only thing that may activate a paid membership there.
  // Without this, a missing env var would let anyone self-activate for free.
  if (isProductionEnv() || process.env.NODE_ENV === "production" || isNedarimConfigured()) {
    return { error: "סימולציה זמינה רק בסביבת פיתוח (לפני חיבור נדרים פלוס)." };
  }
  const user = await getUser();
  if (!user) redirect("/login");

  await activateSubscription({ profileId: user.id, plan });
  redirect("/forum");
}

/**
 * "אני מגיעה בתור מנטורית" — switches her onto the free, approval-based track:
 * role mentor + free tier, and the profile gate reopens so she fills the
 * MENTOR questionnaire (shared answers she already gave stay pre-filled).
 * Until an admin approves, she is a pending member like any other.
 */
export async function applyAsMentor(): Promise<void> {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data: me } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", user.id)
    .maybeSingle();
  // Only a not-yet-active member may switch tracks — an active member asking
  // to mentor goes through the admin (מינוי), not through self-serve.
  if (!me || me.status === "active") redirect("/join");
  // Service role, deliberately: the profiles guard trigger silently reverts
  // role/tier changes from a member's own context — which left applicants as
  // free JUNIORS facing the junior questionnaire (the tester's bug). The
  // action itself is the gate: her own row, pre-active only, fixed values.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient()
    .from("profiles")
    .update({ role: "mentor", member_tier: "free", profile_completed: false })
    .eq("id", user.id);
  // The (app) layout shows the mentor questionnaire while profile_completed
  // is false — land her straight on it.
  // Same-route redirects are soft no-ops without this — the wizard must
  // re-render with the mentor scope.
  revalidatePath("/", "layout");
  redirect("/forum");
}

/** She clicked the mentor track by mistake — back to the paid junior track. */
/**
 * A mentor — pending OR approved — chooses the regular member track from her
 * PROFILE page (the owner, 1/9: "בהגדרת הפרופיל צריך לאפשר למנטורית להתחרט").
 * She becomes a junior on the paid track; the member questionnaire reopens
 * (shared answers pre-filled); a payer is activated straight back as מנויה.
 */
export async function switchMentorToMemberTrack(): Promise<void> {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data: me } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || me.role !== "mentor" || me.status === "rejected") redirect("/profile");
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient()
    .from("profiles")
    // An active MENTOR is not a payer — as a junior, "active" means paying
    // (the honest gating), so she starts pending and the reconcile below
    // activates her only if she actually pays.
    .update({ role: "junior", member_tier: "paid", status: "pending", profile_completed: false })
    .eq("id", user.id);
  try {
    const { reconcileSubscriberStatus } = await import("@/lib/payments/external");
    await reconcileSubscriberStatus(user.id, user.email);
  } catch (e) {
    console.error("[profile] mentor switch reconcile failed:", user.id, e);
  }
  revalidatePath("/", "layout");
  redirect("/forum");
}

export async function revertMentorApplication(): Promise<void> {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data: me } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || me.status === "active" || me.role !== "mentor") redirect("/join");
  // Same trigger story as applyAsMentor — the revert must also bypass it.
  // profile_completed resets too, symmetrically: she may have completed the
  // MENTOR questionnaire meanwhile, and carrying that "completed" back to the
  // junior track produced a junior with no junior answers (מרים, 31/8) —
  // the wizard reopens with her shared answers pre-filled.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient()
    .from("profiles")
    .update({ role: "junior", member_tier: "paid", profile_completed: false })
    .eq("id", user.id);
  // If she already paid, the way back leads straight into the community.
  try {
    const { reconcileSubscriberStatus } = await import("@/lib/payments/external");
    await reconcileSubscriberStatus(user.id, user.email);
  } catch (e) {
    console.error("[join] revert reconcile failed:", user.id, e);
  }
  revalidatePath("/", "layout");
  redirect("/join");
}
