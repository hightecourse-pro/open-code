// Employer-portal authentication. Deliberately separate from member auth:
// clients are companies we hand a username and a short password to, not
// Supabase users. They get their own signed cookie and never touch the
// members' session.

import crypto from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/ai/crypto";

const COOKIE = "oc_portal";
const MAX_AGE = 60 * 60 * 12; // a working day

export interface PortalClient {
  id: string;
  company_name: string;
  username: string;
  /** May this client free-search all candidates, or only see the ones we sent her? */
  can_search: boolean;
}

/** Missing column (pre-migration) and null both mean the safe default: no free search. */
function readCanSearch(row: { can_search?: boolean | null }): boolean {
  return row.can_search === true;
}

function sessionSecret(): string {
  // Reuses the app's existing server secret; falls back so local dev works.
  const secret = process.env.PORTAL_SESSION_SECRET || process.env.AI_KEY_SECRET || "";
  if (!secret) {
    // Silently returning "" used to hand out cookies that could never be
    // accepted again — the client logged in "successfully" and then bounced on
    // the login page forever, with nothing in the logs to explain it.
    throw new Error(
      "portal_session_secret_missing: set PORTAL_SESSION_SECRET (see .env.example) — the employer portal cannot sign sessions without it"
    );
  }
  return secret;
}

/** Whether portal sessions can work at all — for a clear message, not a guess. */
export function isPortalSessionConfigured(): boolean {
  return !!(process.env.PORTAL_SESSION_SECRET || process.env.AI_KEY_SECRET);
}

// ------------------------------------------------------------- passwords

/**
 * Passwords are stored ENCRYPTED, not hashed, on purpose: the admin generates
 * them and has to be able to read them back to hand to the client. The table
 * is admin-only and they gate nothing beyond privacy-filtered profiles.
 */
export function encryptPassword(password: string): string {
  return encryptSecret(password);
}

export function decryptPassword(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}

/** Constant-time string compare, length-safe. */
function constantEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** Legacy scrypt verification, for any client created before the switch. */
function verifyLegacy(password: string, hash: string, salt: string): boolean {
  const computed = crypto.scryptSync(password.normalize("NFKC"), salt, 64).toString("hex");
  return constantEquals(computed, hash);
}

/**
 * A short password that's easy to read out over the phone: no look-alike
 * characters (0/O, 1/l/I), grouped for legibility.
 */
export function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const pick = () =>
    alphabet[crypto.randomInt(0, alphabet.length)];
  const group = () => Array.from({ length: 4 }, pick).join("");
  return `${group()}-${group()}`;
}

// -------------------------------------------------------------- sessions

function sign(value: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

/**
 * A fingerprint of the client's CURRENT credentials, mixed into the session
 * signature. Resetting the password changes it, which invalidates every live
 * cookie — otherwise "the old password stops working immediately" would only
 * be true for the login form, and whoever was already inside stayed inside.
 */
function credentialFingerprint(row: {
  password_enc?: string | null;
  password_hash?: string | null;
}): string {
  const material = row.password_enc ?? row.password_hash ?? "";
  return crypto.createHash("sha256").update(material).digest("base64url").slice(0, 16);
}

/** `<clientId>.<expiry>.<signature>` — stateless, tamper-evident. */
function buildToken(clientId: string, fingerprint: string): string {
  const payload = `${clientId}.${Date.now() + MAX_AGE * 1000}`;
  return `${payload}.${sign(`${payload}.${fingerprint}`)}`;
}

/** Parsed shape only — the signature needs the client row to be verified. */
function parseToken(token: string): { clientId: string; expiry: string; signature: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [clientId, expiry, signature] = parts;
  if (!clientId || !expiry || !signature) return null;
  if (Number(expiry) < Date.now()) return null;
  return { clientId, expiry, signature };
}

function signatureMatches(
  parsed: { clientId: string; expiry: string; signature: string },
  fingerprint: string
): boolean {
  const expected = sign(`${parsed.clientId}.${parsed.expiry}.${fingerprint}`);
  const a = Buffer.from(parsed.signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function startPortalSession(clientId: string): Promise<void> {
  const { data } = await createAdminClient()
    .from("portal_clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();
  const jar = await cookies();
  jar.set(COOKIE, buildToken(clientId, credentialFingerprint(data ?? {})), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: MAX_AGE,
  });
}

export async function endPortalSession(): Promise<void> {
  const jar = await cookies();
  // The session cookie is scoped to path=/portal. A bare delete() targets
  // path=/ — a different cookie as far as the browser cares — so logout would
  // silently leave the real session alive. Expire it on its own path instead.
  jar.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: 0,
  });
}

/** The signed-in client, or null. Also re-checks that access is still active. */
export async function getPortalClient(): Promise<PortalClient | null> {
  // sessionSecret() throws when unset — a loud misconfiguration beats a portal
  // that quietly refuses every session it just issued.
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const parsed = parseToken(token);
  if (!parsed) return null;

  // select("*") so this works whether or not the can_search migration ran.
  const { data } = await createAdminClient()
    .from("portal_clients")
    .select("*")
    .eq("id", parsed.clientId)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  // Signed against the credentials as they were at login — a password reset
  // since then ends this session too.
  if (!signatureMatches(parsed, credentialFingerprint(data))) return null;
  // A signed-in client always has credentials; leads without a username never log in.
  return {
    id: data.id,
    company_name: data.company_name,
    username: data.username ?? "",
    can_search: readCanSearch(data),
  };
}

/** Verify credentials. Returns the client on success, null otherwise. */
export async function authenticate(username: string, password: string): Promise<PortalClient | null> {
  const admin = createAdminClient();
  // select("*") so this works whether or not the password_enc migration ran.
  const { data } = await admin
    .from("portal_clients")
    .select("*")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  if (!data || !data.is_active) return null;

  const enc = (data as { password_enc?: string | null }).password_enc;
  const stored = decryptPassword(enc);
  const ok = stored
    ? constantEquals(password, stored)
    : !!data.password_hash &&
      !!data.password_salt &&
      verifyLegacy(password, data.password_hash, data.password_salt);
  if (!ok) return null;

  await admin
    .from("portal_clients")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.id);

  return {
    id: data.id,
    company_name: data.company_name,
    username: data.username ?? "",
    can_search: readCanSearch(data),
  };
}
