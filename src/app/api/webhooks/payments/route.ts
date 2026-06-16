import { NextResponse } from "next/server";
import { getNedarimConfig, parseNedarimCallback } from "@/lib/payments/nedarim";
import { activateSubscription } from "@/lib/payments/subscription";

/**
 * Nedarim Plus server-to-server CallBack. This is the source of truth for a
 * successful payment — it activates the member's subscription via the service
 * role (RLS-bypassing), regardless of what the browser did.
 */
export async function POST(req: Request) {
  const cfg = getNedarimConfig();
  if (!cfg) {
    return NextResponse.json({ error: "payments not configured" }, { status: 503 });
  }

  // Nedarim posts form-encoded data (accept JSON too, just in case).
  const params: Record<string, string> = {};
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    Object.assign(params, await req.json());
  } else {
    const form = await req.formData();
    for (const [k, v] of form.entries()) params[k] = String(v);
  }

  // Minimal authenticity check: the callback must carry our Mosad id.
  // TODO: add full signature/hash verification per the Nedarim account docs.
  if (params.Mosad && params.Mosad !== cfg.mosadId) {
    return NextResponse.json({ error: "unrecognized mosad" }, { status: 401 });
  }

  const cb = parseNedarimCallback(params);

  // Acknowledge non-success callbacks so Nedarim stops retrying, but do nothing.
  if (!cb.ok || !cb.profileId || !cb.plan) {
    return NextResponse.json({ ok: false, handled: false });
  }

  await activateSubscription({
    profileId: cb.profileId,
    plan: cb.plan,
    providerPaymentId: cb.transactionId,
    amountAgorot: cb.amountAgorot ?? undefined,
    raw: params,
  });

  return NextResponse.json({ ok: true });
}
