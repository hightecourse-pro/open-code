import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSiteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The "הסרה" link at the foot of every mail (the owner, 18/10). The link is
 * signed per address, so a click from the inbox identifies her without a
 * login; a typed address on the page is not trusted for the irreversible
 * choice (leaving) - that one gets a confirmation mail with a signed link.
 */
export const UNSUB_PLACEHOLDER = "{{UNSUB_URL}}";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || getSiteUrl();

function secret(): string {
  return process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
export function looksLikeEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

export function unsubscribeToken(email: string): string {
  const s = secret();
  if (!s) return "";
  return createHmac("sha256", s).update(normalizeEmail(email)).digest("hex").slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expect = unsubscribeToken(email);
  if (!expect || expect.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(expect), Buffer.from(token));
}

export function encodeEmail(email: string): string {
  return Buffer.from(normalizeEmail(email)).toString("base64url");
}
export function decodeEmail(e: string | null | undefined): string | null {
  if (!e) return null;
  try {
    const s = Buffer.from(e, "base64url").toString("utf8");
    return looksLikeEmail(s) ? normalizeEmail(s) : null;
  } catch {
    return null;
  }
}

/** Signed when we know the address; the bare page otherwise (she types it). */
export function unsubscribeUrl(email?: string | null, opts?: { leave?: boolean }): string {
  const base = `${SITE}/unsubscribe`;
  if (!email) return base;
  const t = unsubscribeToken(email);
  if (!t) return base;
  return `${base}?e=${encodeEmail(email)}&t=${t}${opts?.leave ? "&leave=1" : ""}`;
}

/** Fill the footer placeholder for one recipient (or the generic page for a merge). */
export function withUnsubscribe(html: string, email?: string | null): string {
  return html.split(UNSUB_PLACEHOLDER).join(unsubscribeUrl(email));
}

export type OptOutKind = "emails" | "left";

export async function optOutKind(email: string): Promise<OptOutKind | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("email_opt_outs").select("kind").eq("email", normalizeEmail(email)).maybeSingle();
  return (data?.kind as OptOutKind | undefined) ?? null;
}

/** The senders ask this before every non-essential mail. */
export async function emailBlockedByOptOut(email: string): Promise<boolean> {
  return (await optOutKind(email)) !== null;
}

/** For a merge: which of these addresses asked us to stop. */
export async function optedOutEmails(emails: string[]): Promise<Set<string>> {
  const admin = createAdminClient();
  const out = new Set<string>();
  const unique = [...new Set(emails.map(normalizeEmail))];
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await admin.from("email_opt_outs").select("email").in("email", unique.slice(i, i + 200));
    for (const r of data ?? []) out.add(r.email);
  }
  return out;
}
