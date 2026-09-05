// Payments made OUTSIDE the app — a direct Nedarim link, a manual charge.
// Their webhooks arrive with no Param1, so there is no profile to activate.
// Match by email when a member already exists; otherwise remember the payment
// and claim it the moment she signs up ("אם היא תיכנס נדע שהיא שילמה").

import { createAdminClient } from "@/lib/supabase/admin";
import { fireTaskTrigger } from "@/lib/admin/tasks";
import { raiseAlert } from "@/lib/alerts";
import { activateSubscription } from "./subscription";
import type { Json, SubscriptionPlan } from "@/types/database";

/**
 * Find an auth user id by email — one indexed SQL lookup (the old paged
 * listUsers scan serialized every auth record and sat in the webhook hot path).
 */
async function userIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("auth_user_id_by_email", { p_email: email });
  return (data as string | null) ?? null;
}

/**
 * A Nedarim charge-failure report (Status:"Error" + Message, usually a keva
 * charge that was refused — "סירוב"). Until 31/8 this shape bounced off the
 * webhook with a 401, Nedarim emailed the owner a developer-report, and
 * NOTHING was documented — איילת טרבלסי's refused first charge left her
 * looking like a clean מנויה. Now it is attributed (email → keva id) and
 * written down as a failed payment + a named alert.
 *
 * Documentation only: it never touches the subscription — whether a refusal
 * should pause anyone is the owner's call, made from the alert.
 */
export async function recordChargeFailure(
  params: Record<string, string>
): Promise<"charge_failure_recorded" | "charge_failure_unmatched" | "charge_failure_duplicate"> {
  const admin = createAdminClient();
  const kevaId = (params.KevaId ?? "").trim();
  const email = params.Mail?.trim().toLowerCase() || null;
  const name = params.ClientName?.trim() || null;
  const message = String(params.Message ?? "").slice(0, 300);
  const errorTime = (params.ErrorTime ?? "").trim();

  // Attribute — the indexed email lookup first, then the keva id against
  // every payment we ever recorded (live charges carry raw.KevaId; imported
  // rows carry it in provider_payment_id).
  let profileId = email ? await userIdByEmail(email) : null;
  let subscriptionId: string | null = null;
  if (kevaId) {
    const { data: prev } = await admin
      .from("payments")
      .select("profile_id, subscription_id")
      .or(
        `provider_payment_id.eq.keva-${kevaId},provider_payment_id.eq.nedarim-keva-${kevaId},raw->>KevaId.eq.${kevaId}`
      )
      .limit(1)
      .maybeSingle();
    if (prev) {
      profileId = profileId ?? prev.profile_id;
      subscriptionId = prev.subscription_id;
    }
  }

  const amountAgorot = Math.round(parseFloat(params.Amount ?? "0") * 100) || 0;
  // ErrorTime keys the dedupe so a re-sent report never duplicates, while a
  // NEW refusal next month is its own record.
  const syntheticId = `keva-fail-${kevaId || email || "unknown"}-${errorTime || "no-time"}`;

  let outcome: "charge_failure_recorded" | "charge_failure_unmatched" | "charge_failure_duplicate" =
    profileId ? "charge_failure_recorded" : "charge_failure_unmatched";
  if (profileId) {
    await fireTaskTrigger("payment_failed", {
      title: `סירוב חיוב: ${name ?? email ?? "לא מזוהה"}`,
      details: message || undefined,
      link: "/admin/payments",
    });
  }
  if (profileId) {
    const { data: seen } = await admin
      .from("payments")
      .select("id")
      .eq("provider_payment_id", syntheticId)
      .maybeSingle();
    if (seen) outcome = "charge_failure_duplicate";
    else
      await admin.from("payments").insert({
        profile_id: profileId,
        subscription_id: subscriptionId,
        provider_payment_id: syntheticId,
        amount_agorot: amountAgorot,
        status: "failed",
        paid_at: null,
        raw: params as unknown as Json,
      });
  }

  if (outcome !== "charge_failure_duplicate") {
    await raiseAlert({
      kind: "payment_charge_failed",
      severity: profileId ? "critical" : "warning",
      title: profileId
        ? `חיוב נכשל אצל נדרים: ${name ?? email ?? "חברה"}`
        : "נדרים דיווחו על חיוב שנכשל — לא זוהתה חברה",
      body: `${name ?? email ?? "מישהי"} חויבה ונדרים דיווחו סירוב: "${message}"${errorTime ? ` (${errorTime})` : ""}${kevaId ? ` · הוראת קבע ${kevaId}` : ""} · ${amountAgorot / 100} ₪. ${
        profileId
          ? "הסירוב תועד ברשימת התשלומים שלה. המנוי לא שונה — ההחלטה אם להשהות היא שלך, ובינתיים כדאי לפנות אליה על עדכון הכרטיס."
          : "לא נמצאה חברה עם הפרטים האלה — כדאי להצליב מול קונסולת נדרים."
      }`,
      context: { params },
      dedupeKey: syntheticId,
    });
  }
  return outcome;
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
      body: `הדיווח הגיע ממקור שהמערכת לא מזהה כנדרים, אז התשלום נשמר אבל לא יפעיל אף אחת. אשרי אותו במסך התשלומים אחרי הצלבה מול קונסולת נדרים. אסמכתא: ${tx.transactionId}.`,
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
 * Make her profile status agree with her money (the owner, 1/9: הדסה was a
 * payer, got demoted from the mentor track, and stayed "pending" although her
 * subscription was LIVE — the claim skips already-claimed rows). Claims any
 * unclaimed payment first, then: a pending junior with a live subscription
 * becomes active. Returns true when she ends up an active subscriber.
 */
export async function reconcileSubscriberStatus(
  profileId: string,
  email?: string | null
): Promise<boolean> {
  await claimExternalPaymentsFor(profileId, email);
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("profiles")
    .select("status, role, member_tier")
    .eq("id", profileId)
    .maybeSingle();
  if (!p || p.role !== "junior") return false;
  // Active alone is not subscriber-hood: a member whose subscription was
  // canceled stays active on the FREE tier — and she is exactly who needs
  // the checkout this reconcile used to bounce away (אסתי, 5/9).
  if (p.status === "active") return p.member_tier === "paid";
  if (p.status !== "pending") return false;
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("profile_id", profileId)
    .maybeSingle();
  const live =
    !!sub &&
    (sub.status === "active" || sub.status === "trialing") &&
    (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
  if (!live) return false;
  await admin.from("profiles").update({ status: "active", member_tier: "paid" }).eq("id", profileId);
  return true;
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
    // Emails are lowercased on insert — exact match rides the partial index
    // (ilike could never use it, and wildcards in a pasted email would match
    // more than intended).
    .eq("email", email.trim().toLowerCase());
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
