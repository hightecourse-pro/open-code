// Send app-generated emails (e.g. the daily digest) through the Resend HTTP API.
// Auth emails go through Supabase Custom SMTP; this is for our own sends.
// Needs RESEND_API_KEY (+ optional EMAIL_FROM) in the environment. Server-only.

const FROM = process.env.EMAIL_FROM || "קוד פתוח <noreply@opencode.org.il>";

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendResendEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "resend_not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [args.to], subject: args.subject, html: args.html }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `resend_${res.status}: ${text.slice(0, 140)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send_failed" };
  }
}
