import { NextResponse } from "next/server";
import { getNedarimConfig, parseNedarimCallback } from "@/lib/payments/nedarim";
import { activateSubscription } from "@/lib/payments/subscription";

/**
 * Nedarim Plus server-to-server CallBack — the source of truth that activates
 * the member's subscription (service role, RLS-bypassing). Accepts POST/GET and
 * query/body params, and logs the payload so we can confirm Nedarim's format in
 * the Vercel runtime logs.
 */
async function handle(req: Request) {
  const cfg = getNedarimConfig();
  const url = new URL(req.url);
  const params: Record<string, string> = {};

  // Query-string params (some callbacks use GET).
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  // Body params (form-encoded, or JSON).
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
      // no/unsupported body — fall through with whatever query params we have
    }
  }

  console.log("[webhook/payments] received", { method: req.method, contentType, params });

  if (!cfg) {
    return NextResponse.json({ error: "payments not configured" }, { status: 503 });
  }
  // Nedarim's callback identifies the institution via "MosadNumber".
  const mosad = params.MosadNumber ?? params.Mosad;
  if (mosad && mosad !== cfg.mosadId) {
    return NextResponse.json({ error: "unrecognized mosad" }, { status: 401 });
  }

  const cb = parseNedarimCallback(params);
  console.log("[webhook/payments] parsed", cb);

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
  console.log("[webhook/payments] activated member", cb.profileId);

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  return handle(req);
}

export async function GET(req: Request) {
  return handle(req);
}
