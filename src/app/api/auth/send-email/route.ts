import crypto from "crypto";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/send";
import {
  confirmSignupEmail,
  genericActionEmail,
  magicLinkEmail,
  resetPasswordEmail,
} from "@/lib/email/templates";

/**
 * Supabase Auth "Send Email Hook". Supabase POSTs here whenever it would send
 * an auth email (signup confirmation, password recovery, magic link, …). We
 * build a branded Hebrew email and send it through the Apps Script mailer, so
 * every member-facing email is on-brand and goes out from our own sender.
 *
 * Enable: Supabase → Authentication → Hooks → "Send Email" → HTTPS →
 *   URL: https://<site>/api/auth/send-email  → copy the generated secret into
 *   SEND_EMAIL_HOOK_SECRET (env).
 */

interface HookPayload {
  user: { email: string; user_metadata?: { full_name?: string } };
  email_data: {
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

// standard-webhooks signature verification.
function verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const base64Secret = secret.replace(/^v1,whsec_/, "").replace(/^whsec_/, "");
  let key: Buffer;
  try {
    key = Buffer.from(base64Secret, "base64");
  } catch {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  // header is a space-separated list of `v1,<signature>`
  return signatureHeader.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    const buf = Buffer.from(sig);
    return buf.length === expectedBuf.length && crypto.timingSafeEqual(buf, expectedBuf);
  });
}

export async function POST(request: Request) {
  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "hook not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(rawBody) as HookPayload;
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const { user, email_data } = payload;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? email_data.site_url;
  const actionUrl =
    `${base}/auth/v1/verify` +
    `?token=${encodeURIComponent(email_data.token_hash)}` +
    `&type=${encodeURIComponent(email_data.email_action_type)}` +
    `&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

  const name = user.user_metadata?.full_name;
  let built;
  switch (email_data.email_action_type) {
    case "recovery":
      built = resetPasswordEmail(actionUrl, name);
      break;
    case "signup":
    case "invite":
      built = confirmSignupEmail(actionUrl, name);
      break;
    case "magiclink":
      built = magicLinkEmail(actionUrl, name);
      break;
    default:
      built = genericActionEmail(actionUrl);
  }

  const result = await sendEmail({ to: user.email, subject: built.subject, html: built.html });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
