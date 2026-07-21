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
}

function sessionSecret(): string {
  // Reuses the app's existing server secret; falls back so local dev works.
  return process.env.PORTAL_SESSION_SECRET || process.env.AI_KEY_SECRET || "";
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

/** `<clientId>.<expiry>.<signature>` — stateless, tamper-evident. */
function buildToken(clientId: string): string {
  const payload = `${clientId}.${Date.now() + MAX_AGE * 1000}`;
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [clientId, expiry, signature] = parts;
  const expected = sign(`${clientId}.${expiry}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(expiry) < Date.now()) return null;
  return clientId;
}

export async function startPortalSession(clientId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, buildToken(clientId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: MAX_AGE,
  });
}

export async function endPortalSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** The signed-in client, or null. Also re-checks that access is still active. */
export async function getPortalClient(): Promise<PortalClient | null> {
  if (!sessionSecret()) return null;
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const clientId = readToken(token);
  if (!clientId) return null;

  const { data } = await createAdminClient()
    .from("portal_clients")
    .select("id, company_name, username, is_active")
    .eq("id", clientId)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return { id: data.id, company_name: data.company_name, username: data.username };
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

  return { id: data.id, company_name: data.company_name, username: data.username };
}
