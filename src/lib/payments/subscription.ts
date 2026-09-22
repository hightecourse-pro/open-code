import { createAdminClient } from "@/lib/supabase/admin";
import { raiseAlert } from "@/lib/alerts";
import { queueRevokeAll } from "@/lib/drive-shares";
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
 * Service-role only - called from the payment webhook and the dev simulator.
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

  // Card replacement (the owner, 1/9): a NEW standing order for a member who
  // already has one means the OLD keva must be canceled in the Nedarim
  // console - Nedarim exposes no cancel API, so the alert is the handoff.
  // Detected BEFORE recording the new payment, off the previous newest one.
  const newKeva = ((input.raw as Record<string, unknown> | null)?.KevaId as string | undefined) ?? null;
  if (newKeva) {
    // EVERY keva id we ever saw for her - raw.KevaId when the webhook carried
    // it, and the digits of "keva-X"/"nedarim-keva-X" provider ids (the
    // imported Nedarim list stores ONLY those - טובה זק's original keva had
    // no raw.KevaId, so the old single-row comparison missed her replacement
    // and both kevas kept charging, 1/9).
    const { data: prevPays } = await admin
      .from("payments")
      .select("provider_payment_id, raw")
      .eq("profile_id", input.profileId)
      .eq("status", "succeeded")
      .order("paid_at", { ascending: false })
      .limit(30);
    const known = new Set<string>();
    for (const pay of prevPays ?? []) {
      const k = (pay.raw as Record<string, unknown> | null)?.KevaId;
      if (k) known.add(String(k));
      const m = /keva-(\d+)$/.exec(pay.provider_payment_id ?? "");
      if (m) known.add(m[1]);
    }
    known.delete(newKeva);
    const oldKeva = known.size > 0 ? [...known].join(", ") : null;
    if (oldKeva) {
      const { data: who } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", input.profileId)
        .maybeSingle();
      await raiseAlert({
        kind: "keva_replaced",
        severity: "critical",
        title: `${who?.full_name ?? "חברה"} החליפה כרטיס אשראי - לבטל את הקבע הישן ${oldKeva} בנדרים`,
        body: `הוקמה הוראת קבע חדשה (${newKeva}) במקום הישנה (${oldKeva}). את הישנה חייבים לבטל ידנית בקונסולת נדרים - אחרת הכרטיס הישן ימשיך להיות מחויב במקביל.`,
        context: { profileId: input.profileId, oldKeva, newKeva },
        dedupeKey: `keva-replace:${newKeva}`,
      });
    }
  }

  // Keep the Nedarim registry current from the callbacks themselves (the
  // owner, 14/9: "בפעמים הבאות תקבל מהקולבק, לא תצטרך מאקסל") - a keva's
  // FIRST callback marks its start date; later charges only refresh the
  // contact fields. The one-time Excel load seeded the history; from here
  // the registry maintains itself.
  if (newKeva) {
    try {
      const rawRec = input.raw as Record<string, string> | null;
      const { data: knownKeva } = await admin
        .from("nedarim_kevas")
        .select("keva_id")
        .eq("keva_id", String(newKeva))
        .maybeSingle();
      if (knownKeva) {
        await admin
          .from("nedarim_kevas")
          .update({
            client_name: rawRec?.ClientName || null,
            email: rawRec?.Mail?.toLowerCase() || null,
            amount_agorot: input.amountAgorot ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("keva_id", String(newKeva));
      } else {
        await admin.from("nedarim_kevas").insert({
          keva_id: String(newKeva),
          client_name: rawRec?.ClientName || null,
          email: rawRec?.Mail?.toLowerCase() || null,
          start_date: new Date().toISOString().slice(0, 10),
          amount_agorot: input.amountAgorot ?? null,
        });
      }
    } catch (e) {
      console.error("[payments] keva registry update failed:", e);
    }
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

  // Activate the member - and RE-assert the paid tier: a junior who was
  // downgraded to free mid-lifecycle (failed keva, cancel) and then charged
  // successfully again stayed free forever, locked out while paying
  // (אסתי רוזנשטיין, 14/9 - this update used to touch status only).
  // Mentors and team never pay, so only a junior's tier follows her money.
  await admin.from("profiles").update({ status: "active" }).eq("id", input.profileId);
  await admin
    .from("profiles")
    .update({ member_tier: "paid" })
    .eq("id", input.profileId)
    .eq("role", "junior");

  // No Drive work here, by design. Activation only decides what she MAY open;
  // the access itself is created when she opens it (ensureAccess). That also
  // keeps this webhook free of Google round-trips - a timed-out webhook gets
  // retried by the provider, which would duplicate the payment.
  return { subscriptionId };
}

/** Marks a subscription canceled/expired and pauses the member's access. */
export async function deactivateSubscription(profileId: string) {
  const admin = createAdminClient();
  // Scoped to live subscriptions so a row that's already canceled (or a
  // freshly renewed one) is never touched by a retry.
  const { error: subErr } = await admin
    .from("subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .in("status", ["active", "trialing", "past_due"]);
  if (subErr) {
    // Don't strip her access on a half-failed update - let the next run retry.
    console.error("[subscriptions] cancel failed, skipping revoke:", subErr.message);
    return;
  }
  // Only an active member gets paused - never overwrite a deliberate
  // 'rejected' (or a pending) state set by an admin.
  await admin
    .from("profiles")
    .update({ status: "paused" })
    .eq("id", profileId)
    .eq("status", "active");

  // Leaving the community also ends access to the Drive material.
  try {
    await queueRevokeAll(profileId);
  } catch (e) {
    console.error("[drive] deactivation queue failed:", e);
  }
}

/**
 * Every Nedarim keva id we ever recorded for her - raw.KevaId from live
 * webhooks plus the digits of "keva-X"/"nedarim-keva-X" provider ids from the
 * imported list. Newest payment first, so the first id is the live order.
 */
export async function kevaIdsFor(profileId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: pays } = await admin
    .from("payments")
    .select("provider_payment_id, raw")
    .eq("profile_id", profileId)
    .order("paid_at", { ascending: false })
    .limit(50);
  const seen: string[] = [];
  for (const pay of pays ?? []) {
    const k = (pay.raw as Record<string, unknown> | null)?.KevaId;
    if (k && !seen.includes(String(k))) seen.push(String(k));
    const m = /keva-(\d+)/.exec(pay.provider_payment_id ?? "");
    if (m && !seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

/**
 * Did this renewal-off state come from a CHARGE-LIMITED Nedarim keva (the
 * 14/9 sync) rather than her own cancel click? Member-facing copy must never
 * say "ביטלת" for these (נחמה וולפא, 15/9).
 */
export async function renewalOffFromLimitedKeva(sub: {
  canceled_at: string | null;
  provider_sub_id: string | null;
}): Promise<boolean> {
  if (!sub.canceled_at || !sub.provider_sub_id?.startsWith("nedarim-keva-")) return false;
  const kevaId = sub.provider_sub_id.replace("nedarim-keva-", "");
  const { data } = await createAdminClient()
    .from("nedarim_kevas")
    .select("end_date")
    .eq("keva_id", kevaId)
    .maybeSingle();
  return !!data?.end_date;
}
