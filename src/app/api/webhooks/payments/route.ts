import { NextResponse } from "next/server";
import { raiseAlert } from "@/lib/alerts";
import { getNedarimConfig, parseNedarimCallback } from "@/lib/payments/nedarim";
import { activateSubscription } from "@/lib/payments/subscription";
import { buildPlans } from "@/lib/payments/plans";
import { getPricingAdmin } from "@/lib/payments/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend";
import type { Json } from "@/types/database";

/**
 * Nedarim Plus server-to-server CallBack — the only path that turns a member
 * into a paying one, so it is treated as hostile input.
 *
 * NOTHING in the iframe payload can authenticate this call: Mosad, ApiValid and
 * the CallBack URL we hand the iframe all travel through the member's own
 * browser. So the caller is authenticated one of two ways, either is enough:
 *
 *   1. WHERE it comes from — Nedarim's own servers (NEDARIM_CALLBACK_IPS, or
 *      the addresses observed in production below). A member's browser cannot
 *      forge a source address on a TCP request that has to reach us.
 *   2. A shared secret she never sees — set NEDARIM_CALLBACK_SECRET and put it
 *      in the CallBack URL configured in the Nedarim ACCOUNT:
 *      https://<site>/api/webhooks/payments?key=<secret>
 *
 * A call that satisfies neither is refused: a free-subscription hole is worse
 * than a payment we have to chase. Refusals are recorded AND emailed to the
 * team, because the failure mode we care about is not noticing.
 */

/**
 * Nedarim's callback addresses, observed in production. Extend via
 * NEDARIM_CALLBACK_IPS rather than editing this — and if a real payment is
 * ever refused as ip_not_allowed, the rejection email carries the address to
 * add.
 */
const KNOWN_NEDARIM_IPS = ["18.194.219.73"];

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

/**
 * Tell the team a payment callback was refused. A refusal means someone may
 * have paid without getting access — the one failure that must never sit
 * quietly in a log. Throttled to once an hour so a hostile caller can't turn
 * this into a mail flood.
 */
async function alertAdmins(record: Record<string, unknown>) {
  try {
    const admin = createAdminClient();
    const { data: last } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "last_webhook_alert_at")
      .maybeSingle();
    const lastAt = typeof last?.value === "string" ? Date.parse(last.value) : 0;
    if (Number.isFinite(lastAt) && Date.now() - lastAt < 60 * 60 * 1000) return;
    await admin
      .from("app_settings")
      .upsert(
        { key: "last_webhook_alert_at", value: new Date().toISOString() as unknown as Json },
        { onConflict: "key" }
      );

    const p = (record.params ?? {}) as Record<string, string>;
    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7">
        <h2 style="color:#C81E66">שיחת תשלום נדחתה — ייתכן שמישהי שילמה ולא קיבלה גישה</h2>
        <p><b>סיבה:</b> ${record.outcome}</p>
        <p><b>כתובת השולח:</b> ${record.ip || "לא ידועה"}</p>
        <p><b>שם:</b> ${p.ClientName ?? "—"} · <b>מייל:</b> ${p.Mail ?? "—"} ·
           <b>סכום:</b> ${p.Amount ?? "—"} ₪ · <b>אישור נדרים:</b> ${p.ID ?? "—"}</p>
        <p>אם זו קריאה אמיתית מנדרים — צריך להוסיף את הכתובת שלמעלה ל־NEDARIM_CALLBACK_IPS
           (או להגדיר NEDARIM_CALLBACK_SECRET בכתובת ה־CallBack בחשבון נדרים), ואז להפעיל
           את המנוי ידנית.</p>
      </div>`;
    const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin");
    for (const a of admins ?? []) {
      const { data: authUser } = await admin.auth.admin.getUserById(a.id);
      const email = authUser?.user?.email;
      if (!email) continue;
      await sendResendEmail({ to: email, subject: "⚠️ תשלום נדחה בשער התשלומים", html });
    }
  } catch (e) {
    console.error("[webhook/payments] alert failed", String(e));
  }
}

function constantEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The caller's address. x-real-ip is preferred because our host sets it from
 * the actual connection; x-forwarded-for is only a fallback for other
 * environments. Both are ultimately headers, which is why the address is one
 * of two accepted proofs and NEDARIM_CALLBACK_SECRET is the stronger one.
 */
function callerIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
}

async function handleCallback(req: Request) {
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
    // "ignored_incomplete" from an UNAUTHENTICATED caller is internet noise.
    // The same payload from Nedarim itself is a different animal: most likely
    // a renewal callback that arrived without Param1/Param2 — a member whose
    // card was charged while nothing was recorded, who will be silently paused
    // 33 days later. That one wakes someone. Duplicates never do.
    const authedIncomplete = outcome === "ignored_incomplete" && !!record.authedBy;
    if ((outcome !== "ignored_incomplete" && outcome !== "duplicate_ignored") || authedIncomplete) {
      // The alerts center is the permanent record (no throttle — dedupe
      // collapses repeats); email stays as a secondary ping, hourly-throttled.
      const p = params as Record<string, string | undefined>;
      await raiseAlert({
        kind: authedIncomplete ? "payment_renewal_incomplete" : "payment_rejected",
        severity: authedIncomplete || record.authedBy ? "critical" : "warning",
        title: authedIncomplete
          ? "חיוב מנדרים הגיע בלי זיהוי חברה — ייתכן חידוש שלא נרשם"
          : `דיווח תשלום נדחה (${outcome})`,
        body: authedIncomplete
          ? `נדרים שלחו דיווח מאומת בלי Param1/Param2. אם זה חיוב חוזר של הוראת קבע — הכרטיס חויב ולא נרשם דבר. אסמכתא: ${p.ID ?? "?"}, סכום: ${p.Amount ?? "?"} ₪.`
          : `סיבה: ${outcome} · אסמכתא: ${p.ID ?? "—"} · סכום: ${p.Amount ?? "—"} ₪ · מקור: ${String(record.ip ?? "?")}`,
        context: record,
        dedupeKey: `webhook:${outcome}:${p.ID ?? String(record.ip ?? "")}`,
      });
      await alertAdmins(record);
    }
    return NextResponse.json({ error }, { status });
  };

  if (!cfg) return reject("not_configured", 503, "payments not configured");

  // 1. Authenticate: the right address, or the shared secret. Either suffices.
  const allowlist = [
    ...KNOWN_NEDARIM_IPS,
    ...(process.env.NEDARIM_CALLBACK_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ];
  const fromNedarim = allowlist.includes(callerIp(req));

  const secret = process.env.NEDARIM_CALLBACK_SECRET ?? "";
  const secretOk = !!secret && !!providedKey && constantEquals(providedKey, secret);

  if (!fromNedarim && !secretOk) {
    return reject(
      providedKey ? "bad_secret" : "unauthenticated_caller",
      401,
      "unauthorized"
    );
  }
  record.authedBy = secretOk ? "secret" : "ip";

  // 2. The Mosad number is required — never "checked only when present".
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

  // 3. The amount is recorded as charged, and flagged when it doesn't match
  // today's price — a standing order keeps charging the price it was created
  // at, so a mismatch usually means the price changed, not fraud. The caller
  // is already authenticated; refusing here would silently stop renewals.
  const plans = buildPlans(await getPricingAdmin());
  const expected = plans[cb.plan].amountAgorot;
  if (cb.amountAgorot !== expected) {
    record.expectedAmountAgorot = expected;
    record.amountMismatch = true;
    console.warn(
      `[webhook/payments] amount ${cb.amountAgorot} != plan ${expected} for ${cb.plan}`
    );
  }
  if (!cb.amountAgorot || cb.amountAgorot <= 0) {
    return reject("non_positive_amount", 400, "amount missing");
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

// Nedarim's docs don't commit to a method, and their portal-only documentation
// can't be checked from here. A POST-only route answered GET with a bare 405 —
// a callback delivered that way would vanish with no diagnostic row and no
// alert, which is exactly the silent failure this route exists to prevent.
// Both methods run the same authentication; the parser already reads the query
// string, and body parsing quietly no-ops when there is none.
export { handleCallback as GET, handleCallback as POST };
