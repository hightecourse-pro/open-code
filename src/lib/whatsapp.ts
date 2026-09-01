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

/** The WhatsApp Business Account id — template listing lives on it. */
export function getWaWabaId(): string {
  return process.env.WHATSAPP_WABA_ID ?? "";
}

export type WaMediaKind = "image" | "video" | "audio" | "document" | "sticker";

/** Message kind for an uploaded file, by its mime. */
export function waKindOfMime(mime: string): WaMediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

/** Upload a file to Meta; the returned id is what a media message sends. */
export async function uploadWaMedia(
  data: Buffer,
  mime: string,
  filename: string
): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  const cfg = getWaConfig();
  if (!cfg) return { ok: false, error: "whatsapp not configured" };
  try {
    const form = new FormData();
    form.set("messaging_product", "whatsapp");
    form.set("file", new Blob([new Uint8Array(data)], { type: mime }), filename);
    const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/media`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.token}` },
      body: form,
    });
    const out = (await res.json().catch(() => null)) as { id?: string; error?: { message?: string } } | null;
    if (!res.ok || !out?.id) return { ok: false, error: out?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, mediaId: out.id };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Send an already-uploaded media file. Same 24h-window rules as text. */
export async function sendWaMedia(
  to: string,
  kind: WaMediaKind,
  mediaId: string,
  opts?: { caption?: string; filename?: string }
): Promise<{ ok: true; waMessageId: string } | { ok: false; error: string }> {
  const cfg = getWaConfig();
  if (!cfg) return { ok: false, error: "whatsapp not configured" };
  const media: Record<string, string> = { id: mediaId };
  if (opts?.caption && kind !== "audio" && kind !== "sticker") media.caption = opts.caption;
  if (opts?.filename && kind === "document") media.filename = opts.filename;
  try {
    const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: kind,
        [kind]: media,
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

export interface WaTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  /** The body text with {{n}} placeholders — for the compose form + preview. */
  bodyText: string;
  paramCount: number;
}

/** The WABA's message templates — only APPROVED ones may be sent. */
export async function listWaTemplates(): Promise<WaTemplate[]> {
  const cfg = getWaConfig();
  const waba = getWaWabaId();
  if (!cfg || !waba) return [];
  try {
    const res = await fetch(
      `${GRAPH}/${waba}/message_templates?fields=name,status,language,category,components&limit=50`,
      { headers: { authorization: `Bearer ${cfg.token}` } }
    );
    const data = (await res.json().catch(() => null)) as {
      data?: { name: string; status: string; language: string; category: string; components?: { type: string; text?: string }[] }[];
    } | null;
    return (data?.data ?? []).map((t) => {
      const body = (t.components ?? []).find((cm) => cm.type === "BODY")?.text ?? "";
      const params = new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]));
      return {
        name: t.name,
        language: t.language,
        status: t.status,
        category: t.category,
        bodyText: body,
        paramCount: params.size,
      };
    });
  } catch {
    return [];
  }
}

/** Open a conversation with an approved template — the only door Meta allows
 *  outside the 24h window. */
export async function sendWaTemplate(
  to: string,
  name: string,
  language: string,
  bodyParams: string[]
): Promise<{ ok: true; waMessageId: string } | { ok: false; error: string }> {
  const cfg = getWaConfig();
  if (!cfg) return { ok: false, error: "whatsapp not configured" };
  try {
    const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name,
          language: { code: language },
          components: bodyParams.length
            ? [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }]
            : [],
        },
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

/** Download an inbound media file from Meta (their links expire — we keep a
 *  copy in our private bucket). */
export async function fetchWaMedia(
  mediaId: string
): Promise<{ ok: true; data: Buffer; mime: string } | { ok: false; error: string }> {
  const cfg = getWaConfig();
  if (!cfg) return { ok: false, error: "whatsapp not configured" };
  try {
    const meta = await fetch(`${GRAPH}/${mediaId}`, {
      headers: { authorization: `Bearer ${cfg.token}` },
    });
    const info = (await meta.json().catch(() => null)) as { url?: string; mime_type?: string } | null;
    if (!meta.ok || !info?.url) return { ok: false, error: `media lookup HTTP ${meta.status}` };
    const bin = await fetch(info.url, { headers: { authorization: `Bearer ${cfg.token}` } });
    if (!bin.ok) return { ok: false, error: `media download HTTP ${bin.status}` };
    return { ok: true, data: Buffer.from(await bin.arrayBuffer()), mime: info.mime_type ?? "application/octet-stream" };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
