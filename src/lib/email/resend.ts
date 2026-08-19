// Send app-generated emails (e.g. the daily digest) through the Resend HTTP API.
// Auth emails go through Supabase Custom SMTP; this is for our own sends.
// Needs RESEND_API_KEY (+ optional EMAIL_FROM) in the environment. Server-only.
import { isProductionEnv } from "@/lib/env";


const FROM = process.env.EMAIL_FROM || "קוד פתוח <noreply@opencode.org.il>";

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Outside production, mail may only reach addresses on EMAIL_ALLOWLIST
 * (comma-separated) — the staging database holds real members' addresses, and
 * a staging test must never land in a real inbox looking exactly like the
 * real thing. Blocked sends return ok:false with a named reason so the caller
 * logs them instead of counting a phantom success.
 */
export function emailGate(to: string): { ok: true; subjectPrefix: string } | { ok: false; error: string } {
  if (isProductionEnv()) return { ok: true, subjectPrefix: "" };
  const allow = (process.env.EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  if (!allow.includes(to.trim().toLowerCase())) {
    console.log(`[email] blocked outside production (not on allowlist): ${to}`);
    return { ok: false, error: "blocked_by_allowlist" };
  }
  return { ok: true, subjectPrefix: "[STAGING] " };
}

export async function sendResendEmail(args: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "resend_not_configured" };
  const gate = emailGate(args.to);
  if (!gate.ok) return { ok: false, error: gate.error };
  args = { ...args, subject: gate.subjectPrefix + args.subject };
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
