// Minimal Google Drive API client over REST, authenticated as a service
// account. Used to grant/revoke per-member access to course and session
// material automatically - the same thing an admin used to do by hand in the
// share queue.
//
// Setup (once, by an admin - see the checklist in the share queue screen):
//   1. Google Cloud → new project → enable the "Google Drive API".
//   2. Create a Service Account, then a JSON key for it.
//   3. Put the content in a Shared Drive and add the service-account email as
//      "Content manager" (or share the folder with it as Editor).
//   4. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in the env.
//
// Everything degrades gracefully: with no credentials the app keeps working
// exactly as before, and shares stay in the manual queue.

import crypto from "crypto";
import { driveAutomationAllowed } from "@/lib/env";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE = "https://www.googleapis.com/drive/v3";
const SCOPE = "https://www.googleapis.com/auth/drive";

/** Drive refused the address because it isn't a usable Google account. */
export class NotAGoogleAccountError extends Error {}

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

/** Tokens per identity: the service account itself, or a Workspace user it impersonates (domain-wide delegation). */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * A service-account access token, cached until shortly before it expires.
 * `as` = a Workspace user to act as (domain-wide delegation) - the hackathon
 * mirror uses it because a service account owns no storage of its own.
 */
async function getAccessToken(as?: string): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = privateKey();
  if (!email || !key) throw new Error("drive_not_configured");

  const now = Math.floor(Date.now() / 1000);
  const cacheKey = as ?? "";
  const cached = cacheKey ? tokenCache.get(cacheKey) : cachedToken;
  if (cached && cached.expiresAt > now + 60) return cached.token;

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
      ...(as ? { sub: as } : {}),
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
  const entry = { token: data.access_token, expiresAt: now + data.expires_in };
  if (cacheKey) tokenCache.set(cacheKey, entry);
  else cachedToken = entry;
  return data.access_token;
}

async function driveFetch(path: string, init: RequestInit = {}, as?: string): Promise<Response> {
  const token = await getAccessToken(as);
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
 * Give an email read access to a Drive file/folder. Idempotent - an existing
 * permission is left as-is.
 */
export async function grantReadAccess(fileId: string, email: string, as?: string): Promise<void> {
  // driveAutomationAllowed, not isProductionEnv: the owner's staging flag
  // (ALLOW_DRIVE_OUTSIDE_PRODUCTION) must open WRITES too - with only the
  // read path open, staging shares sat pending forever ("הקורסים לא נפתחים").
  if (!driveAutomationAllowed()) {
    throw new Error("drive_write_blocked_outside_production");
  }
  const body = JSON.stringify({ role: "reader", type: "user", emailAddress: email });
  const qs = "supportsAllDrives=true&sendNotificationEmail=false";

  let res = await driveFetch(`/files/${encodeURIComponent(fileId)}/permissions?${qs}`, {
    method: "POST",
    body,
  }, as);

  if (!res.ok) {
    const text = await res.text();
    // Google refuses silent sharing with addresses that aren't Google
    // accounts - retry with a notification email, which is allowed.
    if (/sendNotificationEmail|not.*Google account|invalidSharingRequest/i.test(text)) {
      res = await driveFetch(
        `/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&sendNotificationEmail=true`,
        { method: "POST", body },
        as
      );
      if (res.ok) return;
      const retryText = await res.text();
      // Only treat it as "she needs a Google address" when Google says so
      // about the ACCOUNT. A generic invalidSharingRequest can equally mean a
      // domain sharing policy blocked us - that's our problem, not hers, and
      // must not trigger an email asking her to fix something.
      if (/not.*a?.*Google account|no.*Google account|invalid.*email|badRequest.*emailAddress/i.test(retryText)) {
        throw new NotAGoogleAccountError(email);
      }
      throw new Error(`drive_share_failed: ${retryText.slice(0, 200)}`);
    }
    throw new Error(`drive_share_failed: ${text.slice(0, 200)}`);
  }
}

/**
 * Remove an email's access to a Drive file/folder. A no-op if not shared.
 * Walks every page of permissions - a popular file can have hundreds, and
 * missing the match would silently leave access in place.
 */
export async function revokeAccess(fileId: string, email: string): Promise<void> {
  if (!driveAutomationAllowed()) {
    throw new Error("drive_write_blocked_outside_production");
  }
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

/**
 * Where the hackathon videos can go (23/10): the SHARED DRIVES the service
 * account was added to (a service account owns no storage, so a My-Drive
 * folder only works when impersonating a Workspace user), plus the folders
 * shared with the identity in use.
 */
export async function listSharedFolders(as?: string): Promise<{ id: string; name: string; owner: string | null; sharedDrive: boolean }[]> {
  const out: { id: string; name: string; owner: string | null; sharedDrive: boolean }[] = [];
  const drives = await driveFetch(`/drives?pageSize=50&fields=drives(id,name)`, {}, as);
  if (drives.ok) {
    const json = (await drives.json()) as { drives?: { id: string; name: string }[] };
    for (const d of json.drives ?? []) out.push({ id: d.id, name: d.name, owner: "כונן שיתופי", sharedDrive: true });
  }
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and sharedWithMe = true and trashed = false");
  const res = await driveFetch(`/files?q=${q}&fields=files(id,name,owners(emailAddress))&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=50`, {}, as);
  if (!res.ok) throw new Error(`drive_list_failed: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { files?: { id: string; name: string; owners?: { emailAddress?: string }[] }[] };
  for (const f of json.files ?? []) out.push({ id: f.id, name: f.name, owner: f.owners?.[0]?.emailAddress ?? null, sharedDrive: false });
  if (as) {
    // Acting as a user: her own folders are candidates too.
    const own = await driveFetch(`/files?q=${encodeURIComponent("mimeType='application/vnd.google-apps.folder' and 'me' in owners and trashed = false")}&fields=files(id,name)&pageSize=50&orderBy=modifiedTime desc`, {}, as);
    if (own.ok) {
      const j = (await own.json()) as { files?: { id: string; name: string }[] };
      for (const f of j.files ?? []) if (!out.some((o) => o.id === f.id)) out.push({ id: f.id, name: f.name, owner: as, sharedDrive: false });
    }
  }
  return out;
}

/**
 * Upload one file into a folder the service account can write to (resumable:
 * an initiate call, then the bytes in one PUT). Returns the new file's id.
 */
export async function uploadToFolder(folderId: string, name: string, mimeType: string, body: Buffer, as?: string): Promise<string> {
  if (!driveAutomationAllowed()) throw new Error("drive_write_blocked_outside_production");
  const token = await getAccessToken(as);
  const init = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": mimeType,
      "x-upload-content-length": String(body.length),
    },
    body: JSON.stringify({ name, parents: [folderId], mimeType }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!init.ok) throw new Error(`drive_upload_init_failed: ${(await init.text()).slice(0, 200)}`);
  const location = init.headers.get("location");
  if (!location) throw new Error("drive_upload_no_session");
  const put = await fetch(location, { method: "PUT", headers: { "content-type": mimeType }, body: new Uint8Array(body), signal: AbortSignal.timeout(240_000) });
  if (!put.ok) throw new Error(`drive_upload_failed: ${(await put.text()).slice(0, 200)}`);
  const json = (await put.json()) as { id?: string };
  if (!json.id) throw new Error("drive_upload_no_id");
  return json.id;
}

/** Trash a file the service account owns (a test clean-up, a wrong mirror). */
export async function trashDriveFile(fileId: string, as?: string): Promise<void> {
  if (!driveAutomationAllowed()) throw new Error("drive_write_blocked_outside_production");
  const res = await driveFetch(`/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, { method: "PATCH", body: JSON.stringify({ trashed: true }) }, as);
  if (!res.ok && res.status !== 404) throw new Error(`drive_trash_failed: ${(await res.text()).slice(0, 200)}`);
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
