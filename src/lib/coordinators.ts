// Coordinator-portal core (the owner, 14/9): institutions' contact people
// (רכזות) get an OTP-only personal area. Deliberately separate from member
// auth AND from the employer portal — a third door, mirroring the portal's
// signed-cookie session so no Supabase user (and no member profile) is ever
// created for a coordinator.

import crypto from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const COOKIE = "oc_coord";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // a week — רכזות check in occasionally
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

export interface Coordinator {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  /** study_place option values she is linked to. */
  institutions: string[];
}

function sessionSecret(): string {
  const secret = process.env.PORTAL_SESSION_SECRET || process.env.AI_KEY_SECRET || "";
  if (!secret) {
    throw new Error(
      "coordinator_session_secret_missing: set PORTAL_SESSION_SECRET — the coordinator portal cannot sign sessions without it"
    );
  }
  // Derived, so coordinator cookies can never be replayed against the
  // employer portal (and vice versa) even though the base secret is shared.
  return crypto.createHmac("sha256", secret).update("coordinator-portal").digest("hex");
}

function sign(value: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function buildToken(contactId: string): string {
  const payload = `${contactId}.${Date.now() + SESSION_MAX_AGE * 1000}`;
  return `${payload}.${sign(payload)}`;
}

function parseToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [contactId, expiry, signature] = parts;
  if (!contactId || !expiry || !signature) return null;
  if (Number(expiry) < Date.now()) return null;
  const expected = sign(`${contactId}.${expiry}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return contactId;
}

export async function startCoordinatorSession(contactId: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, buildToken(contactId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/coordinator",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endCoordinatorSession(): Promise<void> {
  const jar = await cookies();
  // Expire on the cookie's own path — a bare delete targets path=/ and
  // silently leaves the real session alive (the portal's hard-won lesson).
  jar.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/coordinator",
    maxAge: 0,
  });
}

/** The signed-in coordinator with her institutions, or null. Memoized per
 *  request — the portal layout and its pages both ask. */
export const getCoordinator = cache(async (): Promise<Coordinator | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const contactId = parseToken(token);
  if (!contactId) return null;

  const admin = createAdminClient();
  const [{ data: contact }, { data: links }] = await Promise.all([
    admin.from("institution_contacts").select("*").eq("id", contactId).maybeSingle(),
    admin.from("institution_contact_links").select("institution").eq("contact_id", contactId),
  ]);
  if (!contact) return null;
  return {
    id: contact.id,
    full_name: contact.full_name,
    email: contact.email,
    phone: contact.phone ?? null,
    institutions: (links ?? []).map((l) => l.institution),
  };
});

// ------------------------------------------------------------------- OTP

function hashOtp(email: string, code: string): string {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(`${email.toLowerCase()}:${code}`)
    .digest("hex");
}

/** A 6-digit code, avoiding leading-zero confusion. */
export function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Store a fresh OTP for a KNOWN contact email. Returns the code to send, or
 * null when the email belongs to no contact — the caller answers identically
 * either way, so the login form never confirms which emails exist.
 */
export async function createOtp(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const clean = email.trim().toLowerCase();
  const { data: contact } = await admin
    .from("institution_contacts")
    .select("id")
    .ilike("email", clean)
    .maybeSingle();
  if (!contact) return null;
  const code = generateOtpCode();
  await admin.from("coordinator_otp").upsert(
    {
      email: clean,
      code_hash: hashOtp(clean, code),
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      attempts: 0,
      created_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );
  return code;
}

/** Verify a code; on success returns the contact id and burns the OTP. */
export async function verifyOtp(email: string, code: string): Promise<string | null> {
  const admin = createAdminClient();
  const clean = email.trim().toLowerCase();
  const { data: row } = await admin
    .from("coordinator_otp")
    .select("*")
    .eq("email", clean)
    .maybeSingle();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.attempts >= OTP_MAX_ATTEMPTS) return null;

  const expected = Buffer.from(row.code_hash);
  const got = Buffer.from(hashOtp(clean, code.trim()));
  const ok = expected.length === got.length && crypto.timingSafeEqual(expected, got);
  if (!ok) {
    await admin
      .from("coordinator_otp")
      .update({ attempts: row.attempts + 1 })
      .eq("email", clean);
    return null;
  }

  await admin.from("coordinator_otp").delete().eq("email", clean);
  const { data: contact } = await admin
    .from("institution_contacts")
    .select("id")
    .ilike("email", clean)
    .maybeSingle();
  return contact?.id ?? null;
}
