import { createAdminClient } from "@/lib/supabase/admin";
import { buildPlans } from "./plans";
import { getPricingAdmin } from "./pricing";
import type { SubscriptionPlan } from "@/types/database";

export interface ActivateInput {
  profileId: string;
  plan: SubscriptionPlan;
  providerPaymentId?: string | null;
  providerSubId?: string | null;
  amountAgorot?: number;
  raw?: unknown;
}

/**
 * Records a successful payment and (re)activates the member's subscription.
 * Service-role only — called from the payment webhook and the dev simulator.
 * This is the single source of truth for "member becomes active".
 */
export async function activateSubscription(input: ActivateInput) {
  const pricing = await getPricingAdmin();
  const plan = buildPlans(pricing)[input.plan];
  const admin = createAdminClient();

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + plan.periodMonths);

  // Upsert the subscription for this member (one active sub per member).
  const { data: existing } = await admin
    .from("subscriptions")
    .select("id")
    .eq("profile_id", input.profileId)
    .maybeSingle();

  let subscriptionId = existing?.id ?? null;

  if (subscriptionId) {
    await admin
      .from("subscriptions")
      .update({
        plan: input.plan,
        status: "active",
        provider_sub_id: input.providerSubId ?? undefined,
        current_period_end: periodEnd.toISOString(),
        canceled_at: null,
      })
      .eq("id", subscriptionId);
  } else {
    const { data: created } = await admin
      .from("subscriptions")
      .insert({
        profile_id: input.profileId,
        plan: input.plan,
        status: "active",
        provider: "nedarim",
        provider_sub_id: input.providerSubId ?? null,
        min_term_months: pricing.minTermMonths,
        current_period_end: periodEnd.toISOString(),
      })
      .select("id")
      .single();
    subscriptionId = created?.id ?? null;
  }

  // Record the payment.
  await admin.from("payments").insert({
    subscription_id: subscriptionId,
    profile_id: input.profileId,
    provider_payment_id: input.providerPaymentId ?? null,
    amount_agorot: input.amountAgorot ?? plan.amountAgorot,
    currency: "ILS",
    status: "succeeded",
    paid_at: new Date().toISOString(),
    raw: (input.raw ?? null) as never,
  });

  // Activate the member.
  await admin.from("profiles").update({ status: "active" }).eq("id", input.profileId);

  // Queue personal Drive shares for every past session — each new member gets
  // all session recordings shared to her individually (admin actions the queue).
  const { data: sessions } = await admin.from("sessions").select("id");
  if (sessions?.length) {
    await admin.from("content_shares").upsert(
      sessions.map((s) => ({
        owner_type: "session" as const,
        owner_id: s.id,
        profile_id: input.profileId,
        status: "pending" as const,
      })),
      { onConflict: "owner_type,owner_id,profile_id", ignoreDuplicates: true }
    );
  }

  return { subscriptionId };
}

/** Marks a subscription canceled/expired and pauses the member's access. */
export async function deactivateSubscription(profileId: string) {
  const admin = createAdminClient();
  await admin
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("profile_id", profileId);
  await admin.from("profiles").update({ status: "paused" }).eq("id", profileId);
}
