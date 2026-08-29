// Keeps Google Drive access in sync with community membership.
//
// Design (since "access on attempt"): a share is created when a member really
// opens something — `ensureAccess` in `src/lib/content-access.ts` does the
// Drive call inside her click. Joining, renewing or publishing a new session
// no longer fan out rows across everyone; they only change WHO MAY unlock.
// The upside is that leaving revokes exactly what she actually opened.
//
// What lives here is the rest of the lifecycle: revokes (leaving, returning a
// course, closing a session back), re-pointing to a new Google address,
// re-opening a share when new material is added — and the worker.
//
// `processShareQueue` (cron + a "sync now" button) is now the RETRY LANE, not
// the engine: it drains rows `ensureAccess` left `pending` after a Drive
// failure and the `revoked` rows waiting to be undone. Normally it runs empty.
//
// `content_shares` stays the source of truth and the audit trail:
//   pending  → should have access, not granted yet
//   shared   → granted in Drive
//   revoked  → should lose access, not yet removed in Drive
// A row is deleted only once it has been fully undone (or was never granted).
// With no Google credentials configured, the queue simply stays as-is and the
// admin actions it by hand — exactly the behaviour before automation existed.

import { createAdminClient } from "@/lib/supabase/admin";
import { driveAutomationAllowed } from "@/lib/env";
import { raiseAlert } from "@/lib/alerts";
import { driveFileId } from "@/lib/drive";
import {
  NotAGoogleAccountError,
  grantReadAccess,
  isDriveAutomationConfigured,
  revokeAccess,
} from "@/lib/drive-api";
import { sendResendEmail } from "@/lib/email/resend";
import { driveEmailRequestEmail } from "@/lib/email/templates";
import type { ContentOwner } from "@/types/database";

// ---------------------------------------------------------------- queueing

/**
 * Mark that a member should have access to these courses/sessions.
 *
 * Returns false when the row could not be written — `ensureAccess` must know,
 * because a Drive grant with no row behind it is access nobody can revoke.
 */
export async function queueShares(
  profileId: string,
  ownerType: ContentOwner,
  ownerIds: string[]
): Promise<boolean> {
  if (ownerIds.length === 0) return true;
  const admin = createAdminClient();

  // A previously-revoked row must come back to life, so upsert (not ignore).
  const { error } = await admin.from("content_shares").upsert(
    ownerIds.map((owner_id) => ({
      owner_type: ownerType,
      owner_id,
      profile_id: profileId,
      status: "pending" as const,
      revoked_at: null,
    })),
    { onConflict: "owner_type,owner_id,profile_id" }
  );
  if (error) {
    console.error("[drive] queueShares failed:", error.message);
    return false;
  }
  return true;
}

/**
 * Mark that a member should lose access to specific content — returning a
 * course, switching to another one. Rows that were never granted are dropped
 * outright; granted ones become `revoked` for the worker to undo.
 *
 * A share an admin opened BY HAND is deliberately left alone: the
 * `granted_manually` branch of `canAccess` treats it as an entitlement of its
 * own, independent of the enrolment, so revoking it here would strip Drive
 * access the app still says she has. A personal share ends when the admin
 * removes it,
 * or when she leaves the community — `queueRevokeAll` below, which does NOT
 * make this exception.
 */
export async function queueRevokes(
  profileId: string,
  ownerType: ContentOwner,
  ownerIds: string[]
): Promise<void> {
  if (ownerIds.length === 0) return;
  const admin = createAdminClient();

  // Before the granted_manually migration the column doesn't exist. The lookup
  // then fails and we simply revoke everything, exactly as we did before the
  // exception existed — a revoke must never fail open.
  const { data: manual, error: manualErr } = await admin
    .from("content_shares")
    .select("id")
    .eq("profile_id", profileId)
    .eq("owner_type", ownerType)
    .eq("granted_manually", true)
    .in("owner_id", ownerIds);
  if (manualErr) console.error("[drive] queueRevokes manual lookup failed:", manualErr.message);
  const keep = manualErr ? [] : (manual ?? []).map((r) => r.id);
  const spare = `(${keep.join(",")})`;

  // Only "pending" is safe to delete — a "revoked" row is outstanding work.
  let cleanup = admin
    .from("content_shares")
    .delete()
    .eq("profile_id", profileId)
    .eq("owner_type", ownerType)
    .eq("status", "pending")
    .in("owner_id", ownerIds);
  if (keep.length > 0) cleanup = cleanup.not("id", "in", spare);
  const { error: delErr } = await cleanup;
  if (delErr) console.error("[drive] queueRevokes cleanup failed:", delErr.message);

  let revoke = admin
    .from("content_shares")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("owner_type", ownerType)
    .eq("status", "shared")
    .in("owner_id", ownerIds);
  if (keep.length > 0) revoke = revoke.not("id", "in", spare);
  const { error } = await revoke;
  if (error) console.error("[drive] queueRevokes failed:", error.message);
}

/**
 * Who a session's recording belongs to. Default: paying members, mentors and
 * the team. Opened to everyone: the whole active community.
 */
async function sessionAudienceIds(openToAll: boolean): Promise<string[]> {
  const out: string[] = [];
  const admin = createAdminClient();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("profiles")
      .select("id, member_tier, role")
      .eq("status", "active")
      .range(from, from + PAGE - 1);
    for (const p of data ?? []) {
      if (openToAll || p.member_tier === "paid" || p.role === "mentor" || p.role === "admin") {
        out.push(p.id);
      }
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/**
 * The session's audience changed.
 *
 * Opening it to everyone grants nothing by itself — it only WIDENS who may
 * unlock it, and the free members who care will open it themselves.
 * Closing it back is the half that still matters here: it takes a real, live
 * Drive permission away from a free member who already opened the session,
 * while paying members, mentors and the team keep theirs.
 */
export async function syncSessionAudience(sessionId: string, openToAll: boolean): Promise<void> {
  if (openToAll) return;

  const admin = createAdminClient();
  const entitled = new Set(await sessionAudienceIds(false));

  // Closing: anyone holding it who is no longer entitled loses it.
  const { data: held } = await admin
    .from("content_shares")
    .select("id, profile_id, status")
    .eq("owner_type", "session")
    .eq("owner_id", sessionId)
    .in("status", ["pending", "shared"]);

  const losing = (held ?? []).filter((r) => !entitled.has(r.profile_id));
  const neverGranted = losing.filter((r) => r.status === "pending").map((r) => r.id);
  const granted = losing.filter((r) => r.status === "shared").map((r) => r.id);

  if (neverGranted.length) {
    await admin.from("content_shares").delete().in("id", neverGranted);
  }
  if (granted.length) {
    const { error } = await admin
      .from("content_shares")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .in("id", granted);
    if (error) console.error("[drive] syncSessionAudience revoke failed:", error.message);
  }
}

/**
 * A member is leaving (paused, rejected, subscription ended): queue removal of
 * everything she was given — personal shares an admin opened by hand included.
 * Deliberately unfiltered: leaving the community ends ALL access to the
 * material, and /admin/shares says so.
 */
export async function queueRevokeAll(profileId: string): Promise<void> {
  const admin = createAdminClient();
  const { error: delErr } = await admin
    .from("content_shares")
    .delete()
    .eq("profile_id", profileId)
    .eq("status", "pending");
  if (delErr) console.error("[drive] queueRevokeAll cleanup failed:", delErr.message);

  const { error } = await admin
    .from("content_shares")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("status", "shared");
  if (error) console.error("[drive] queueRevokeAll failed:", error.message);
}

/**
 * She gave us a different Google address: reopen everything already granted
 * so the worker moves it from the old address to the new one.
 */
export async function repointSharesToNewEmail(profileId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("content_shares")
    .update({ status: "pending" })
    .eq("profile_id", profileId)
    .eq("status", "shared");
  if (error) console.error("[drive] repoint failed:", error.message);
}

/**
 * Material added to a course/session after members already have it: reopen
 * their rows so the worker grants the new link too.
 */
export async function requeueOwnerForSharedMembers(
  ownerType: ContentOwner,
  ownerId: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("content_shares")
    .update({ status: "pending" })
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .eq("status", "shared");
  if (error) console.error("[drive] requeueOwner failed:", error.message);
}

// ------------------------------------------------------------------ worker

export interface SyncResult {
  configured: boolean;
  granted: number;
  revoked: number;
  failed: number;
  skipped: number;
  /** Members emailed because their address isn't a Google account. */
  gmailRequested: number;
  /**
   * What Google actually said, for the first few failures. A bare count tells
   * an admin nothing — "the service account cannot see this file" tells her
   * exactly what to fix.
   */
  errors?: string[];
}

/**
 * Where to share this member's material: the Google address she gave us if
 * she has one, otherwise the address she signed up with.
 */
export async function emailOf(profileId: string): Promise<string | null> {
  const admin = createAdminClient();
  try {
    // Backward-safe: before the migration the table is missing, and we fall
    // straight through to the login address.
    const { data } = await admin
      .from("member_private")
      .select("drive_email")
      .eq("profile_id", profileId)
      .maybeSingle();
    const preferred = data?.drive_email?.trim();
    if (preferred) return preferred;
  } catch {
    // ignore — fall back below
  }
  try {
    const { data } = await admin.auth.admin.getUserById(profileId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

/**
 * Her address can't receive Drive access — ask her (once) for a Google one.
 * Returns true when an email was actually sent.
 */
async function requestGmail(profileId: string): Promise<boolean> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: priv, error: privErr }] = await Promise.all([
    admin.from("profiles").select("full_name, first_name").eq("id", profileId).maybeSingle(),
    admin
      .from("member_private")
      .select("drive_email_requested_at")
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);
  // Without the migration we can't throttle, so don't risk emailing on a loop.
  if (privErr || !profile) return false;
  if (priv?.drive_email_requested_at) return false;

  const { data: authUser } = await admin.auth.admin.getUserById(profileId);
  const to = authUser?.user?.email;
  if (!to) return false;

  const built = driveEmailRequestEmail(
    profile.first_name || profile.full_name?.split(" ")[0] || undefined
  );
  const sent = await sendResendEmail({ to, subject: built.subject, html: built.html });

  // Record the attempt either way. If the send failed we still must not retry
  // the whole Drive+Resend round trip every 15 minutes forever — the admin
  // sees the row waiting in the share queue.
  await admin.from("member_private").upsert(
    { profile_id: profileId, drive_email_requested_at: new Date().toISOString() },
    { onConflict: "profile_id" }
  );

  if (!sent.ok) {
    console.error("[drive] gmail request email failed:", sent.error);
    return false;
  }
  return true;
}

/** Drive object ids for a course/session, skipping links that aren't Drive URLs. */
export async function fileIdsFor(ownerType: ContentOwner, ownerId: string): Promise<string[]> {
  return (await linksFor(ownerType, ownerId)).driveIds;
}

/**
 * The owner's links split into Drive ids and a total count — the queue needs
 * both, because "no Drive links yet" and "the links exist but live on YouTube"
 * call for opposite treatments.
 */
export async function linksFor(
  ownerType: ContentOwner,
  ownerId: string
): Promise<{ driveIds: string[]; totalLinks: number }> {
  const { data } = await createAdminClient()
    .from("content_links")
    .select("url")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId);
  const driveIds: string[] = [];
  for (const l of data ?? []) {
    const id = driveFileId(l.url);
    if (id) driveIds.push(id);
  }
  return { driveIds, totalLinks: (data ?? []).length };
}

/**
 * Action a bounded batch of the queue against Drive. Safe to run repeatedly —
 * every step is idempotent, and anything that fails is simply retried next
 * run (or handled by hand in the admin queue).
 */
export async function processShareQueue(limit = 60): Promise<SyncResult> {
  const result: SyncResult = {
    configured: isDriveAutomationConfigured(),
    granted: 0,
    revoked: 0,
    failed: 0,
    skipped: 0,
    gmailRequested: 0,
  };
  if (!result.configured) return result;
  // One Google service account serves BOTH environments (owner decision), so
  // the only thing between a staging test and a real member losing access to
  // her course material is this gate. Outside production the queue is
  // read-only: rows stay visible in /admin/shares, nothing reaches Google.
  if (!driveAutomationAllowed()) {
    console.log("[drive] share queue untouched — drive automation off here");
    return result;
  }

  const admin = createAdminClient();

  // Members we've already asked for a Google address and who haven't answered
  // yet can't be granted anything. They're excluded from the batch entirely —
  // otherwise their rows sit at the head of the queue and starve everyone
  // else's, run after run. Saving an address clears the flag, which puts her
  // straight back in.
  const { data: waiting } = await admin
    .from("member_private")
    .select("profile_id")
    .not("drive_email_requested_at", "is", null)
    .limit(500);
  const blocked = (waiting ?? []).map((p) => p.profile_id);

  const COLS = "id, owner_type, owner_id, profile_id, status, granted_email, created_at";

  // Two plain queries rather than one clever combined filter: grants skip the
  // members we're waiting on, revokes always run (they need no Google account).
  // The blocked set is filtered in JS after an over-fetch: inlining hundreds
  // of UUIDs into a NOT IN querystring approaches URL/header limits at scale.
  const blockedSet = new Set(blocked);
  const pendingQuery = admin
    .from("content_shares")
    .select(COLS)
    .eq("status", "pending");

  const [{ data: pendingRowsRaw }, { data: revokedRows }] = await Promise.all([
    pendingQuery.order("created_at", { ascending: true }).limit(limit + blocked.length),
    admin
      .from("content_shares")
      .select(COLS)
      .eq("status", "revoked")
      .order("created_at", { ascending: true })
      .limit(limit),
  ]);

  const pendingRows = (pendingRowsRaw ?? []).filter((r) => !blockedSet.has(r.profile_id));
  // Revokes first — losing access should never wait behind a backlog of grants.
  const rows = [...(revokedRows ?? []), ...pendingRows].slice(0, limit);
  if (rows.length === 0) return result;

  // Resolve each member's email and each owner's file list once per batch.
  const emails = new Map<string, string | null>();
  const files = new Map<string, { driveIds: string[]; totalLinks: number }>();
  // Members whose address Drive rejected — asked for a Gmail once per batch.
  const askedForGmail = new Set<string>();

  // Budget by Google API calls, not rows: one course can hold 10 Drive links,
  // so 60 rows could mean 600+ sequential Drive calls — past any time limit.
  const DRIVE_CALL_BUDGET = 120;
  let driveCalls = 0;
  for (const row of rows) {
    if (driveCalls >= DRIVE_CALL_BUDGET) break; // next run continues the queue
    // Her address already failed earlier in this batch — skip her remaining
    // GRANTS (revokes need no valid Google account, so they still run).
    if (row.status === "pending" && askedForGmail.has(row.profile_id)) {
      result.skipped++;
      continue;
    }
    if (!emails.has(row.profile_id)) emails.set(row.profile_id, await emailOf(row.profile_id));
    const email = emails.get(row.profile_id);
    if (!email) {
      result.skipped++;
      continue;
    }

    const key = `${row.owner_type}:${row.owner_id}`;
    if (!files.has(key)) files.set(key, await linksFor(row.owner_type, row.owner_id));
    const { driveIds: ids, totalLinks } = files.get(key) ?? { driveIds: [], totalLinks: 0 };
    if (ids.length === 0) {
      // Content whose links live entirely off Drive (a YouTube recording) has
      // nothing to grant — the URL itself is the access. Mark such grants done
      // instead of leaving them "pending" forever in the admin queue (two real
      // members sat there for a day over a YouTube-only session). Content with
      // NO links yet keeps waiting — its Drive folder may still be coming.
      if (row.status === "pending" && totalLinks > 0) {
        await admin
          .from("content_shares")
          .update({ status: "shared", shared_at: new Date().toISOString() })
          .eq("id", row.id);
        result.granted++;
        continue;
      }
      // A revoke with nothing on Drive is already fully undone.
      if (row.status === "revoked") {
        await admin.from("content_shares").delete().eq("id", row.id);
        result.revoked++;
        continue;
      }
      result.skipped++;
      continue;
    }

    // Always act on the address the share was actually granted to — if she
    // changed her Gmail, the OLD address is the one holding the permission.
    const grantedTo = row.granted_email ?? null;

    try {
      if (row.status === "pending") {
        // Re-pointing to a new address: take the old one off first, so a
        // changed Gmail never leaves an orphaned permission behind.
        if (grantedTo && grantedTo.toLowerCase() !== email.toLowerCase()) {
          for (const fileId of ids) {
            await revokeAccess(fileId, grantedTo);
            driveCalls++;
          }
        }
        for (const fileId of ids) {
          await grantReadAccess(fileId, email);
          driveCalls++;
        }
        await admin
          .from("content_shares")
          .update({
            status: "shared",
            shared_at: new Date().toISOString(),
            granted_email: email,
          })
          .eq("id", row.id);
        result.granted++;
      } else {
        for (const fileId of ids) {
          await revokeAccess(fileId, grantedTo ?? email);
          driveCalls++;
        }
        // Fully undone → the audit row has served its purpose.
        await admin.from("content_shares").delete().eq("id", row.id);
        result.revoked++;
      }
    } catch (e) {
      if (e instanceof NotAGoogleAccountError) {
        // Not a real failure of ours: she just needs to give us a Gmail.
        // The row stays pending and syncs by itself once she adds one.
        askedForGmail.add(row.profile_id);
        if (await requestGmail(row.profile_id)) result.gmailRequested++;
        else result.skipped++;
        continue;
      }
      // Left in place: retried next run, and visible in the manual queue.
      result.failed++;
      console.error(`[drive] ${row.status} failed (${key} → ${email}):`, e);
      if ((result.errors ??= []).length < 3) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push(`${key} → ${email}: ${msg.slice(0, 300)}`);
      }
    }
  }

  if (result.failed > 0) {
    await raiseAlert({
      kind: "drive_share_failed",
      severity: "warning",
      title: `${result.failed} שיתופי דרייב נכשלו בסבב האחרון`,
      body: "התור ב'תור שיתופים' מציג את הפרטים; שגיאות חוזרות בדרך כלל אומרות שהמפתח של גוגל או ההרשאות על התיקייה השתנו.",
      context: result,
      dedupeKey: "drive-share-failed",
    });
  }
  return result;
}
