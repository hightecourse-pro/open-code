// WhatsApp Cloud API — the community's number lives at Meta, no phone
// involved (the owner has a kosher device; the Bezeq landline 02-5800296 is
// the registered number once she completes the Meta signup). Everything here
// runs server-side with the token from the environment.

const GRAPH = "https://graph.facebook.com/v21.0";

export interface WaConfig {
  token: string;
  phoneNumberId: string;
}

/** Null until the owner finishes the Meta signup and the env vars land. */
export function getWaConfig(): WaConfig | null {
  const token = process.env.WHATSAPP_TOKEN ?? "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

/** The webhook's GET-verification secret — settable before the token exists. */
export function getWaVerifyToken(): string {
  return process.env.WHATSAPP_VERIFY_TOKEN ?? "";
}

/**
 * An Israeli phone in any common shape → WhatsApp id digits (9725XXXXXXXX),
 * or null when it doesn't look like a phone at all.
 */
export function toWaId(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits.length >= 11 ? digits : null;
}

/**
 * Send a free-form text message. The CALLER enforces Meta's 24-hour service
 * window — outside it this returns Meta's error, it does not pre-check.
 */
export async function sendWaText(
  to: string,
  body: string
): Promise<{ ok: true; waMessageId: string } | { ok: false; error: string }> {
  const cfg = getWaConfig();
  if (!cfg) return { ok: false, error: "whatsapp not configured" };
  try {
    const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body },
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      messages?: { id: string }[];
      error?: { message?: string };
    } | null;
    if (!res.ok || !data?.messages?.[0]?.id) {
      return { ok: false, error: data?.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, waMessageId: data.messages[0].id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** How much of Meta's 24-hour reply window is left, in ms (0 = closed). */
export function waWindowLeftMs(lastInboundAt: string | null): number {
  if (!lastInboundAt) return 0;
  const closesAt = new Date(lastInboundAt).getTime() + 24 * 60 * 60 * 1000;
  return Math.max(0, closesAt - Date.now());
}
