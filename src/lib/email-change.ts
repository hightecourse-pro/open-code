import crypto from "node:crypto";

/**
 * A signed, self-contained "switch this account to that address" token (the
 * owner, 14/10: the team changes a member's email for her, but it must take
 * effect only after SHE confirms from the new address). Nothing is stored:
 * the link carries profile id, new address and expiry, signed with the
 * server secret; /auth/email-change verifies it and applies the change.
 */
const TTL_MS = 48 * 3600 * 1000;

function secret(): string {
  const s = process.env.AI_KEY_SECRET ?? process.env.CRON_SECRET;
  if (!s) throw new Error("email-change: no server secret configured");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", `email-change:${secret()}`).update(payload).digest("base64url");
}

export function signEmailChange(profileId: string, newEmail: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ p: profileId, e: newEmail.trim().toLowerCase(), x: now + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyEmailChange(token: string, now = Date.now()): { profileId: string; newEmail: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const { p, e, x } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { p: string; e: string; x: number };
    if (!p || !e || typeof x !== "number" || x < now) return null;
    return { profileId: p, newEmail: e };
  } catch {
    return null;
  }
}
