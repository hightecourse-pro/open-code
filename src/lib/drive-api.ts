// Minimal Google Drive API client over REST, authenticated as a service
// account. Used to grant/revoke per-member access to course and session
// material automatically — the same thing an admin used to do by hand in the
// share queue.
//
// Setup (once, by an admin — see the checklist in the share queue screen):
//   1. Google Cloud → new project → enable the "Google Drive API".
//   2. Create a Service Account, then a JSON key for it.
//   3. Put the content in a Shared Drive and add the service-account email as
//      "Content manager" (or share the folder with it as Editor).
//   4. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in the env.
//
// Everything degrades gracefully: with no credentials the app keeps working
// exactly as before, and shares stay in the manual queue.

import crypto from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE = "https://www.googleapis.com/drive/v3";
const SCOPE = "https://www.googleapis.com/auth/drive";

export function isDriveAutomationConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

function privateKey(): string {
  // Env vars can't hold real newlines, so the key is stored with "\n".
  return (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

let cachedToken: { token: string; expiresAt: number } | null = null;

/** A service-account access token, cached until shortly before it expires. */
async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = privateKey();
  if (!email || !key) throw new Error("drive_not_configured");

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.token;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = base64url(
    crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key)
  );
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`drive_auth_failed: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in };
  return data.access_token;
}

async function driveFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${DRIVE}${path}`, {
    ...init,
    // Never let a hanging Google call stall the request that triggered it.
    signal: AbortSignal.timeout(15_000),
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
}

/**
 * Give an email read access to a Drive file/folder. Idempotent — an existing
 * permission is left as-is.
 */
export async function grantReadAccess(fileId: string, email: string): Promise<void> {
  const body = JSON.stringify({ role: "reader", type: "user", emailAddress: email });
  const qs = "supportsAllDrives=true&sendNotificationEmail=false";

  let res = await driveFetch(`/files/${encodeURIComponent(fileId)}/permissions?${qs}`, {
    method: "POST",
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    // Google refuses silent sharing with addresses that aren't Google
    // accounts — retry with a notification email, which is allowed.
    if (/sendNotificationEmail|not.*Google account|invalidSharingRequest/i.test(text)) {
      res = await driveFetch(
        `/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&sendNotificationEmail=true`,
        { method: "POST", body }
      );
      if (res.ok) return;
      throw new Error(`drive_share_failed: ${(await res.text()).slice(0, 200)}`);
    }
    throw new Error(`drive_share_failed: ${text.slice(0, 200)}`);
  }
}

/**
 * Remove an email's access to a Drive file/folder. A no-op if not shared.
 * Walks every page of permissions — a popular file can have hundreds, and
 * missing the match would silently leave access in place.
 */
export async function revokeAccess(fileId: string, email: string): Promise<void> {
  const needle = email.toLowerCase();
  let pageToken: string | undefined;

  do {
    const qs = new URLSearchParams({
      supportsAllDrives: "true",
      pageSize: "100",
      fields: "nextPageToken,permissions(id,emailAddress,role)",
    });
    if (pageToken) qs.set("pageToken", pageToken);

    const listRes = await driveFetch(
      `/files/${encodeURIComponent(fileId)}/permissions?${qs.toString()}`
    );
    if (!listRes.ok) {
      throw new Error(`drive_list_failed: ${(await listRes.text()).slice(0, 200)}`);
    }
    const data = (await listRes.json()) as {
      nextPageToken?: string;
      permissions?: { id: string; emailAddress?: string; role: string }[];
    };

    for (const p of data.permissions ?? []) {
      if (p.emailAddress?.toLowerCase() !== needle || p.role === "owner") continue;
      const delRes = await driveFetch(
        `/files/${encodeURIComponent(fileId)}/permissions/${p.id}?supportsAllDrives=true`,
        { method: "DELETE" }
      );
      if (!delRes.ok && delRes.status !== 404) {
        throw new Error(`drive_revoke_failed: ${(await delRes.text()).slice(0, 200)}`);
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
}

/** Probe the credentials (used by the admin screen to show a live status). */
export async function checkDriveAccess(): Promise<{ ok: boolean; error?: string }> {
  if (!isDriveAutomationConfigured()) return { ok: false, error: "not_configured" };
  try {
    await getAccessToken();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
