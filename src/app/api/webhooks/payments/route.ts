import { NextResponse } from "next/server";
import { getNedarimConfig, parseNedarimCallback } from "@/lib/payments/nedarim";
import { activateSubscription } from "@/lib/payments/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/** Best-effort diagnostic: record the last webhook call so we can inspect it. */
async function logEvent(value: Record<string, unknown>) {
  try {
    const admin = createAdminClient();
    await admin
      .from("app_settings")
      .upsert({ key: "last_webhook", value: value as unknown as Json }, { onConflict: "key" });
  } catch (e) {
    console.log("[webhook/payments] diagnostic write failed", String(e));
  }
}

/**
 * Nedarim Plus server-to-server CallBack — activates the member's subscription
 * via the service role. Logs to console + app_settings.last_webhook for diagnosis.
 */
async function handle(req: Request) {
  const cfg = getNedarimConfig();
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const contentType = req.headers.get("content-type") ?? "";
  if (req.method === "POST") {
    try {
      if (contentType.includes("application/json")) {
        Object.assign(params, await req.json());
      } else {
        const form = await req.formData();
        for (const [k, v] of form.entries()) params[k] = String(v);
      }
    } catch {
      // no/unsupported body
    }
  }

  const record: Record<string, unknown> = {
    at: new Date().toISOString(),
    method: req.method,
    contentType,
    params,
  };
  console.log("[webhook/payments] received", record);

  if (!cfg) {
    record.outcome = "not_configured";
    await logEvent(record);
    return NextResponse.json({ error: "payments not configured" }, { status: 503 });
  }

  const mosad = params.MosadNumber ?? params.Mosad;
  if (mosad && mosad !== cfg.mosadId) {
    record.outcome = "unrecognized_mosad";
    await logEvent(record);
    return NextResponse.json({ error: "unrecognized mosad" }, { status: 401 });
  }

  const cb = parseNedarimCallback(params);
  record.parsed = cb as unknown as Record<string, unknown>;

  if (!cb.ok || !cb.profileId || !cb.plan) {
    record.outcome = "ignored_incomplete";
    await logEvent(record);
    return NextResponse.json({ ok: false, handled: false });
  }

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
    console.log("[webhook/payments] activation error", String(e));
  }

  await logEvent(record);
  return NextResponse.json({ ok: record.outcome === "activated" });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
