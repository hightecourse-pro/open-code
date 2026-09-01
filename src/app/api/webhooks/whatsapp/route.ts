import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { raiseAlert } from "@/lib/alerts";
import { getWaVerifyToken } from "@/lib/whatsapp";

/**
 * Meta WhatsApp Cloud API webhook.
 *
 * GET — Meta's one-time subscription check: echo hub.challenge when
 * hub.verify_token matches ours.
 *
 * POST — inbound messages and delivery statuses. Authenticated by
 * X-Hub-Signature-256 (HMAC of the raw body with the app secret) when
 * WHATSAPP_APP_SECRET is set; before it is set the webhook only accepts
 * traffic when the verify token is configured at all, and stores nothing
 * sensitive beyond what a chat inbox needs. Always answers 200 fast — Meta
 * retries aggressively and disables webhooks that keep failing.
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const expected = getWaVerifyToken();
  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "verification failed" }, { status: 403 });
}

type WaWebhookValue = {
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: {
    id: string;
    from: string;
    timestamp?: string;
    type?: string;
    text?: { body?: string };
    button?: { text?: string };
    interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  }[];
  statuses?: { id: string; status?: string; errors?: { title?: string; message?: string }[] }[];
};

/** The human-readable body of any inbound message type we don't fully model. */
function bodyOf(m: NonNullable<WaWebhookValue["messages"]>[number]): string {
  if (m.text?.body) return m.text.body;
  if (m.button?.text) return m.button.text;
  if (m.interactive?.button_reply?.title) return m.interactive.button_reply.title;
  if (m.interactive?.list_reply?.title) return m.interactive.list_reply.title;
  return `[הודעת ${m.type ?? "מדיה"} — פתחי בוואטסאפ ווב אם צריך]`;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  // Signature check — load-bearing once the app secret is configured.
  const appSecret = process.env.WHATSAPP_APP_SECRET ?? "";
  if (appSecret) {
    const sig = req.headers.get("x-hub-signature-256") ?? "";
    const expected =
      "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "bad signature" }, { status: 401 });
    }
  } else if (!getWaVerifyToken()) {
    // Nothing configured at all — this endpoint is not yet open for business.
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  let payload: { entry?: { changes?: { value?: WaWebhookValue }[] }[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true, ignored: "not json" });
  }

  const admin = createAdminClient();
  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const nameOf = new Map(
          (value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null])
        );

        for (const m of value.messages ?? []) {
          // Contact row — upsert by wa_id, keep the freshest pushed name.
          const { data: contact } = await admin
            .from("wa_contacts")
            .upsert(
              {
                wa_id: m.from,
                display_name: nameOf.get(m.from) ?? undefined,
                last_message_at: new Date().toISOString(),
                last_inbound_at: new Date().toISOString(),
              },
              { onConflict: "wa_id" }
            )
            .select("id, display_name")
            .single();
          if (!contact) continue;
          // Idempotent on Meta's message id — redeliveries change nothing.
          await admin
            .from("wa_messages")
            .upsert(
              {
                contact_id: contact.id,
                direction: "in",
                body: bodyOf(m).slice(0, 4000),
                wa_message_id: m.id,
                status: "received",
                raw: m as unknown as import("@/types/database").Json,
              },
              { onConflict: "wa_message_id", ignoreDuplicates: true }
            );
          await raiseAlert({
            kind: "whatsapp_inbound",
            severity: "info",
            title: `הודעת וואטסאפ חדשה מ${contact.display_name ?? m.from}`,
            body: `${bodyOf(m).slice(0, 160)} — מענה במסך הוואטסאפ בניהול.`,
            context: { wa_id: m.from },
            // One alert per contact per hour — a burst is one conversation.
            dedupeKey: `wa:${m.from}:${new Date().toISOString().slice(0, 13)}`,
          });
        }

        for (const s of value.statuses ?? []) {
          // Only statuses our check constraint knows — Meta has more exotic ones.
          if (!s.id || !s.status || !["sent", "delivered", "read", "failed"].includes(s.status)) continue;
          await admin
            .from("wa_messages")
            .update({
              status: s.status as "sent" | "delivered" | "read" | "failed",
              error:
                s.status === "failed"
                  ? s.errors?.map((e) => e.message ?? e.title).join("; ") ?? "failed"
                  : undefined,
            })
            .eq("wa_message_id", s.id);
        }
      }
    }
  } catch (e) {
    // Store failures must not make Meta retry-storm us — log and answer 200.
    console.error("[webhook/whatsapp] store failed", String(e));
  }
  return NextResponse.json({ ok: true });
}
