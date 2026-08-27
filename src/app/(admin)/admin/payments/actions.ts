"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { activateSubscription } from "@/lib/payments/subscription";
import { raiseAlert } from "@/lib/alerts";

/**
 * Approve a payment that arrived from an unrecognized caller: the admin
 * checked it against the Nedarim console. Clearing the flag also retries the
 * email auto-match — if the payer is already a member, she activates now.
 */
export async function approveExternalPayment(id: string): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("external_payments")
    .select("id, email, plan, amount_agorot, provider_payment_id, raw, claimed_at")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.claimed_at) return;

  await admin.from("external_payments").update({ needs_review: false }).eq("id", id);

  if (row.email) {
    // Same paged lookup the webhook path uses.
    for (let page = 1; page <= 5; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const hit = data?.users?.find((u) => u.email?.toLowerCase() === row.email!.toLowerCase());
      if (hit) {
        await activateSubscription({
          profileId: hit.id,
          plan: row.plan === "annual" ? "annual" : "monthly",
          providerPaymentId: row.provider_payment_id,
          amountAgorot: row.amount_agorot ?? undefined,
          raw: row.raw ?? undefined,
        });
        await admin
          .from("external_payments")
          .update({ claimed_by: hit.id, claimed_at: new Date().toISOString() })
          .eq("id", id);
        break;
      }
      if (!data || data.users.length < 1000) break;
    }
  }
  revalidatePath("/admin/payments");
}

/**
 * Hand-assign a waiting payment to a member (the two-emails case): activates
 * her subscription off this payment and marks it claimed.
 */
export async function assignExternalPayment(id: string, profileId: string): Promise<void> {
  await requireRole("admin");
  if (!profileId) return;
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("external_payments")
    .select("id, plan, amount_agorot, provider_payment_id, raw, claimed_at, client_name")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.claimed_at) return;

  await activateSubscription({
    profileId,
    plan: row.plan === "annual" ? "annual" : "monthly",
    providerPaymentId: row.provider_payment_id,
    amountAgorot: row.amount_agorot ?? undefined,
    raw: row.raw ?? undefined,
  });
  await admin
    .from("external_payments")
    .update({ claimed_by: profileId, claimed_at: new Date().toISOString(), needs_review: false })
    .eq("id", id);
  await raiseAlert({
    kind: "external_payment_claimed",
    severity: "info",
    title: `תשלום חיצוני שויך ידנית (${row.client_name ?? "ללא שם"}) והמנוי הופעל`,
    body: `אסמכתא ${row.provider_payment_id} שויכה ידנית ממסך התשלומים החיצוניים.`,
    context: { profileId, transactionId: row.provider_payment_id },
    dedupeKey: `ext-claim:${row.provider_payment_id}`,
  });
  revalidatePath("/admin/payments");
  revalidatePath("/admin/members");
}

/** Remove a row that will never be claimed (refund, duplicate, noise). */
export async function deleteExternalPayment(id: string): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("external_payments").delete().eq("id", id).is("claimed_at", null);
  revalidatePath("/admin/payments");
}
