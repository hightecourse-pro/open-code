// Employer-portal authentication. Deliberately separate from member auth:
// clients are companies we hand a username and a short password to, not
// Supabase users. They get their own signed cookie and never touch the
// members' session.

import crypto from "crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

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

/** scrypt hash — no external dependency, and slow enough to be worth it. */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password.normalize("NFKC"), s, 64).toString("hex");
  return { hash, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = hashPassword(password, salt).hash;
  const a = Buffer.from(computed);
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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
  const { data } = await admin
    .from("portal_clients")
    .select("id, company_name, username, password_hash, password_salt, is_active")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  if (!data || !data.is_active) return null;
  if (!verifyPassword(password, data.password_hash, data.password_salt)) return null;

  await admin
    .from("portal_clients")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", data.id);

  return { id: data.id, company_name: data.company_name, username: data.username };
}
