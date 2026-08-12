import { NextResponse } from "next/server";
import { getNedarimConfig, parseNedarimCallback } from "@/lib/payments/nedarim";
import { activateSubscription } from "@/lib/payments/subscription";
import { buildPlans } from "@/lib/payments/plans";
import { getPricingAdmin } from "@/lib/payments/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Nedarim Plus server-to-server CallBack — the only path that turns a member
 * into a paying one, so it is treated as hostile input.
 *
 * NOTHING in the iframe payload can authenticate this call: Mosad, ApiValid and
 * the CallBack URL we hand the iframe all travel through the member's own
 * browser. The shared secret therefore has to come from somewhere she never
 * sees — the CallBack URL configured in the Nedarim account itself:
 *
 *     https://<site>/api/webhooks/payments?key=<NEDARIM_CALLBACK_SECRET>
 *
 * With no secret configured we refuse to activate anyone. That is deliberate:
 * a broken payment flow is recoverable, a free-subscription hole is not.
 */

/** Best-effort diagnostic. Keeps the last call AND the last rejection. */
async function logEvent(value: Record<string, unknown>) {
  try {
    const admin = createAdminClient();
    const rows = [{ key: "last_webhook", value: value as unknown as Json }];
    // Rejections are the interesting ones — a successful call would otherwise
    // immediately overwrite the evidence of an attempt.
    if (value.outcome !== "activated") {
      rows.push({ key: "last_webhook_rejected", value: value as unknown as Json });
    }
    await admin.from("app_settings").upsert(rows, { onConflict: "key" });
  } catch (e) {
    console.log("[webhook/payments] diagnostic write failed", String(e));
  }
}

function constantEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The caller's address, as far as the proxy in front of us reports it. */
function callerIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || req.headers.get("x-real-ip") || "").trim();
}

export async function POST(req: Request) {
  const cfg = getNedarimConfig();
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      Object.assign(params, await req.json());
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) params[k] = String(v);
    }
  } catch {
    // no/unsupported body — the query string may still carry the call
  }

  // The secret never belongs in the diagnostic record.
  const providedKey = params.key ?? req.headers.get("x-callback-key") ?? "";
  delete params.key;

  const record: Record<string, unknown> = {
    at: new Date().toISOString(),
    method: req.method,
    ip: callerIp(req),
    contentType,
    params,
  };
  const reject = async (outcome: string, status: number, error: string) => {
    record.outcome = outcome;
    console.warn("[webhook/payments] rejected:", outcome, record);
    await logEvent(record);
    return NextResponse.json({ error }, { status });
  };

  if (!cfg) return reject("not_configured", 503, "payments not configured");

  // 1. Shared secret — configured in the Nedarim account's CallBack URL.
  const secret = process.env.NEDARIM_CALLBACK_SECRET ?? "";
  if (!secret) {
    return reject(
      "no_secret_configured",
      503,
      "callback secret not configured — refusing to activate"
    );
  }
  if (!providedKey || !constantEquals(providedKey, secret)) {
    return reject("bad_secret", 401, "unauthorized");
  }

  // 2. Optional IP allowlist, when the provider's addresses are known.
  const allowlist = (process.env.NEDARIM_CALLBACK_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowlist.length && !allowlist.includes(callerIp(req))) {
    return reject("ip_not_allowed", 403, "forbidden");
  }

  // 3. The Mosad number is required — never "checked only when present".
  const mosad = params.MosadNumber ?? params.Mosad ?? "";
  if (!mosad || mosad !== cfg.mosadId) {
    return reject("unrecognized_mosad", 401, "unrecognized mosad");
  }

  const cb = parseNedarimCallback(params);
  record.parsed = cb as unknown as Record<string, unknown>;

  if (!cb.ok || !cb.profileId || !cb.plan) {
    return reject("ignored_incomplete", 200, "ignored");
  }
  if (!cb.transactionId) {
    return reject("missing_transaction_id", 400, "missing transaction id");
  }

  // 4. The amount has to be the price of the plan it claims to pay for.
  const plans = buildPlans(await getPricingAdmin());
  const expected = plans[cb.plan].amountAgorot;
  if (cb.amountAgorot !== expected) {
    record.expectedAmountAgorot = expected;
    return reject("amount_mismatch", 400, "amount does not match plan");
  }

  const admin = createAdminClient();

  // 5. Idempotency — a replayed callback must not extend anything.
  const { data: seen } = await admin
    .from("payments")
    .select("id")
    .eq("provider_payment_id", cb.transactionId)
    .maybeSingle();
  if (seen) {
    record.outcome = "duplicate_ignored";
    await logEvent(record);
    return NextResponse.json({ ok: true, handled: false });
  }

  // 6. The member must actually exist.
  const { data: member } = await admin
    .from("profiles")
    .select("id")
    .eq("id", cb.profileId)
    .maybeSingle();
  if (!member) return reject("unknown_member", 400, "unknown member");

  try {
    await activateSubscription({
      profileId: cb.profileId,
      plan: cb.plan,
      providerPaymentId: cb.transactionId,
      amountAgorot: cb.amountAgorot ?? undefined,
      raw: params,
    });
    record.outcome = "activated";
    console.log("[webhook/payments] activated member", cb.profileId);
  } catch (e) {
    record.outcome = `activate_error: ${String(e)}`;
    console.error("[webhook/payments] activation error", String(e));
  }

  await logEvent(record);
  return NextResponse.json({ ok: record.outcome === "activated" });
}
