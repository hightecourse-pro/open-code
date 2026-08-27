// Payments made OUTSIDE the app — a direct Nedarim link, a manual charge.
// Their webhooks arrive with no Param1, so there is no profile to activate.
// Match by email when a member already exists; otherwise remember the payment
// and claim it the moment she signs up ("אם היא תיכנס נדע שהיא שילמה").

import { createAdminClient } from "@/lib/supabase/admin";
import { raiseAlert } from "@/lib/alerts";
import { activateSubscription } from "./subscription";
import type { Json, SubscriptionPlan } from "@/types/database";

/** Find an auth user id by email (small community — paged lookup is fine). */
async function userIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  for (let page = 1; page <= 5; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const hit = data?.users?.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (!data || data.users.length < 1000) break;
  }
  return null;
}

/**
 * An authenticated, successful payment webhook with nobody to hang it on.
 * Returns the outcome string for the webhook's diagnostic record.
 */
export async function handleExternalPayment(
  params: Record<string, string>,
  tx: { transactionId: string; plan: SubscriptionPlan | null; amountAgorot: number | null },
  /**
   * needsReview: the caller could NOT be authenticated (an unrecognized IP —
   * usually Nedarim on a new server, conceivably not). The payment is stored
   * but must not activate anyone until the admin confirms it.
   */
  opts?: { needsReview?: boolean; callerIp?: string }
): Promise<
  "external_matched_activated" | "external_stored" | "external_stored_unverified" | "external_duplicate"
> {
  const admin = createAdminClient();
  const email = params.Mail?.trim().toLowerCase() || null;
  const name = params.ClientName?.trim() || null;
  const needsReview = opts?.needsReview === true;

  if (email && !needsReview) {
    const profileId = await userIdByEmail(email);
    if (profileId) {
      await activateSubscription({
        profileId,
        plan: tx.plan ?? "monthly",
        providerPaymentId: tx.transactionId,
        amountAgorot: tx.amountAgorot ?? undefined,
        raw: params,
      });
      await raiseAlert({
        kind: "external_payment_matched",
        severity: "info",
        title: `תשלום חיצוני זוהה לפי המייל והפעיל את ${name ?? email}`,
        body: `אסמכתא ${tx.transactionId} · ${(tx.amountAgorot ?? 0) / 100} ₪ — התשלום לא הגיע דרך האתר (ללא זיהוי חברה), אבל הכתובת ${email} רשומה אצלנו והמנוי הופעל אוטומטית.`,
        context: { profileId, transactionId: tx.transactionId },
        dedupeKey: `ext-pay:${tx.transactionId}`,
      });
      return "external_matched_activated";
    }
  }

  const { error } = await admin.from("external_payments").insert({
    email,
    phone: params.Phone?.trim() || null,
    zeout: params.Zeout?.trim() || null,
    client_name: name,
    provider_payment_id: tx.transactionId,
    amount_agorot: tx.amountAgorot,
    plan: tx.plan ?? "monthly",
    raw: params as unknown as Json,
    needs_review: needsReview,
  });
  if (error) {
    // unique(provider_payment_id) — a replayed webhook is already recorded.
    if (error.message.includes("duplicate")) return "external_duplicate";
    throw error;
  }
  if (needsReview) {
    await raiseAlert({
      kind: "external_payment_unverified",
      severity: "warning",
      title: `תשלום ממקור לא מזוהה ממתין לאישור: ${name ?? email ?? "ללא שם"} · ${(tx.amountAgorot ?? 0) / 100} ₪`,
      body: `הקריאה הגיעה מכתובת שאינה ברשימת נדרים המוכרות (${opts?.callerIp ?? "?"}). התשלום נשמר אבל לא יפעיל אף אחת — אשרי אותו במסך התשלומים החיצוניים אחרי הצלבה מול קונסולת נדרים. אסמכתא: ${tx.transactionId}.`,
      context: { transactionId: tx.transactionId, callerIp: opts?.callerIp },
      dedupeKey: `ext-pay:${tx.transactionId}`,
    });
    return "external_stored_unverified";
  }
  await raiseAlert({
    kind: "external_payment_stored",
    severity: "info",
    title: `תשלום מחוץ לאתר נשמר: ${name ?? email ?? "ללא שם"} · ${(tx.amountAgorot ?? 0) / 100} ₪`,
    body: `אין עדיין חשבון עם הכתובת ${email ?? "?"} — ברגע שתירשם ותשלים פרופיל, המנוי יופעל לה אוטומטית. אסמכתא: ${tx.transactionId}.`,
    context: { transactionId: tx.transactionId },
    dedupeKey: `ext-pay:${tx.transactionId}`,
  });
  return "external_stored";
}

/**
 * She exists now — claim any unclaimed external payment carrying her email.
 * Cheap when there is nothing to claim (one indexed select). Returns true
 * when something activated.
 */
export async function claimExternalPaymentsFor(profileId: string, email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("external_payments")
    .select("id, provider_payment_id, plan, amount_agorot, raw")
    .is("claimed_at", null)
    // Unverified rows never auto-activate — the admin confirms them first.
    .eq("needs_review", false)
    .ilike("email", email.trim());
  if (!rows?.length) return false;

  for (const row of rows) {
    await activateSubscription({
      profileId,
      plan: row.plan === "annual" ? "annual" : "monthly",
      providerPaymentId: row.provider_payment_id,
      amountAgorot: row.amount_agorot ?? undefined,
      raw: row.raw ?? undefined,
    });
    await admin
      .from("external_payments")
      .update({ claimed_by: profileId, claimed_at: new Date().toISOString() })
      .eq("id", row.id);
    await raiseAlert({
      kind: "external_payment_claimed",
      severity: "info",
      title: "תשלום חיצוני שויך — חברה שנרשמה זוהתה כמי ששילמה",
      body: `אסמכתא ${row.provider_payment_id} שויכה והמנוי הופעל אוטומטית.`,
      context: { profileId, transactionId: row.provider_payment_id },
      dedupeKey: `ext-claim:${row.provider_payment_id}`,
    });
  }
  return true;
}
