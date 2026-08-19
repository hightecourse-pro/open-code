// Email sender — posts to the Google Apps Script web app (see
// scripts/google-apps-script/). The script does the actual sending through the
// Workspace account. Server-only.
import { emailGate } from "@/lib/email/resend";


export interface Recipient {
  email: string;
  name?: string;
}

export interface SendEmailArgs {
  subject: string;
  /** HTML body. For group sends, `{{name}}` is replaced per recipient. */
  html: string;
  /** Single recipient… */
  to?: string;
  name?: string;
  /** …or a group (mail-merge). */
  recipients?: Recipient[];
}

export type SendResult =
  | { ok: true; sent: number; remainingDailyQuota?: number }
  | { ok: false; error: string };

export function isEmailConfigured(): boolean {
  return !!process.env.APPS_SCRIPT_EMAIL_URL && !!process.env.APPS_SCRIPT_EMAIL_SECRET;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendResult> {
  const url = process.env.APPS_SCRIPT_EMAIL_URL;
  const secret = process.env.APPS_SCRIPT_EMAIL_SECRET;
  if (!url || !secret) return { ok: false, error: "email_not_configured" };

  // Same environment gate as the Resend path: outside production only
  // allowlisted addresses, and the subject says where it came from.
  const recipients = args.recipients ?? (args.to ? [{ email: args.to, name: args.name }] : []);
  const gates = recipients.map((r) => ({ r, gate: emailGate(r.email) }));
  const allowed = gates.filter((g) => g.gate.ok).map((g) => g.r);
  if (allowed.length === 0) return { ok: false, error: "blocked_by_allowlist" };
  if (allowed.length < recipients.length) {
    args = args.recipients
      ? { ...args, recipients: allowed }
      : { ...args, to: allowed[0].email, name: allowed[0].name };
  }
  const firstGate = gates.find((g) => g.gate.ok)?.gate;
  if (firstGate && firstGate.ok && firstGate.subjectPrefix) {
    args = { ...args, subject: firstGate.subjectPrefix + args.subject };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, ...args }),
      // Apps Script 302-redirects to googleusercontent; fetch follows it.
      redirect: "follow",
    });
    const data = (await res.json()) as SendResult;
    return data;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send_failed" };
  }
}
