// Email sender — posts to the Google Apps Script web app (see
// scripts/google-apps-script/). The script does the actual sending through the
// Workspace account. Server-only.

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
