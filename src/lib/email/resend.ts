// Send app-generated emails (e.g. the daily digest) through the Resend HTTP API.
// Auth emails go through Supabase Custom SMTP; this is for our own sends.
// Needs RESEND_API_KEY (+ optional EMAIL_FROM) in the environment. Server-only.
import { isProductionEnv } from "@/lib/env";
import { emailBlockedByOptOut, withUnsubscribe } from "@/lib/unsubscribe";


const FROM = process.env.EMAIL_FROM || "קוד פתוח <noreply@opencode.org.il>";
// Replies to app mail land in the team's inbox, not in the noreply box (the owner, 25/10: ״האם כל התשובות מגיעות ל-office?״).
const REPLY_TO = process.env.EMAIL_REPLY_TO || "office@opencode.org.il";

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Outside production, mail may only reach addresses on EMAIL_ALLOWLIST
 * (comma-separated) - the staging database holds real members' addresses, and
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
  /** Account mail (a confirmation she asked for, her subscription) goes out even to an address that opted out of our mails. */
  essential?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "resend_not_configured" };
  const gate = emailGate(args.to);
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!args.essential && (await emailBlockedByOptOut(args.to))) return { ok: false, error: "opted_out" };
  args = { ...args, subject: gate.subjectPrefix + args.subject, html: withUnsubscribe(args.html, args.to) };
  try {
    const post = () =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [args.to], reply_to: REPLY_TO, subject: args.subject, html: args.html }),
      });
    let res = await post();
    // Resend allows 2 requests/second - a 429 is a pace problem, not a bad
    // address. One breath and one retry before giving up (the owner, 5/10:
    // job announcements were silently dropped on refusals).
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1200));
      res = await post();
    }
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `resend_${res.status}: ${text.slice(0, 140)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send_failed" };
  }
}

export interface BatchItem {
  to: string;
  subject: string;
  html: string;
}
export type BatchOutcome = { ok: true } | { ok: false; error: string };

/**
 * Resend's batch endpoint: up to 100 emails per request, and the rate limit
 * (2 requests/second) counts requests - so ~200 emails a second instead of 2
 * (the owner, 5/10: "זה לוקח הרבה מידי זמן!!"). Each item gets its own
 * outcome; a refused request marks every item in it. Outside production the
 * allowlist gate applies per item, exactly like the single sender.
 */
/** The html of one batch item as it goes out: the footer's "הסרה" signed for
 *  that recipient. Exported so the preview route can show exactly this - the
 *  batch path used to send the raw {{UNSUB_URL}} placeholder, and Gmail
 *  rendered "הסרה" as dead text (the owner, 21/10). */
export function batchItemHtml(item: Pick<BatchItem, "to" | "html">): string {
  return withUnsubscribe(item.html, item.to);
}

export async function sendResendBatch(items: BatchItem[]): Promise<BatchOutcome[]> {
  const key = process.env.RESEND_API_KEY;
  const outcomes: BatchOutcome[] = items.map(() => ({ ok: false, error: "resend_not_configured" }));
  if (!key) return outcomes;
  const allowed: { idx: number; item: BatchItem }[] = [];
  items.forEach((item, idx) => {
    const gate = emailGate(item.to);
    if (!gate.ok) {
      outcomes[idx] = { ok: false, error: gate.error };
      return;
    }
    allowed.push({ idx, item: { ...item, subject: gate.subjectPrefix + item.subject, html: batchItemHtml(item) } });
  });
  for (let i = 0; i < allowed.length; i += 100) {
    const chunk = allowed.slice(i, i + 100);
    const post = () =>
      fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify(chunk.map(({ item }) => ({ from: FROM, to: [item.to], reply_to: REPLY_TO, subject: item.subject, html: item.html }))),
      });
    try {
      let res = await post();
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1200));
        res = await post();
      }
      if (!res.ok) {
        const text = (await res.text()).slice(0, 140);
        for (const { idx } of chunk) outcomes[idx] = { ok: false, error: `resend_${res.status}: ${text}` };
      } else {
        for (const { idx } of chunk) outcomes[idx] = { ok: true };
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : "send_failed";
      for (const { idx } of chunk) outcomes[idx] = { ok: false, error };
    }
    // Pace: 2 requests a second.
    if (i + 100 < allowed.length) await new Promise((r) => setTimeout(r, 550));
  }
  return outcomes;
}
