// Keeps Google Drive access in sync with community membership.
//
// Design: membership events (join, leave, start/return a course, add a
// session) only WRITE TO THE QUEUE — a couple of fast database rows, no
// network calls. A separate worker (`processShareQueue`, driven by a cron
// route and a "sync now" button in the admin screen) does the actual Drive
// work in bounded batches.
//
// That split matters: activateSubscription runs inside the payment webhook,
// and blocking it on dozens of Google round-trips would risk a timeout — and
// a timed-out webhook gets retried by the provider, duplicating payments.
//
// `content_shares` stays the source of truth and the audit trail:
//   pending  → should have access, not granted yet
//   shared   → granted in Drive
//   revoked  → should lose access, not yet removed in Drive
// A row is deleted only once it has been fully undone (or was never granted).
// With no Google credentials configured, the queue simply stays as-is and the
// admin actions it by hand — exactly the behaviour before automation existed.

import { createAdminClient } from "@/lib/supabase/admin";
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

/** Mark that a member should have access to these courses/sessions. */
export async function queueShares(
  profileId: string,
  ownerType: ContentOwner,
  ownerIds: string[]
): Promise<void> {
  if (ownerIds.length === 0) return;
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
  if (error) console.error("[drive] queueShares failed:", error.message);
}

/**
 * Mark that a member should lose access. Rows that were never granted are
 * dropped outright; granted ones become `revoked` for the worker to undo.
 */
export async function queueRevokes(
  profileId: string,
  ownerType: ContentOwner,
  ownerIds: string[]
): Promise<void> {
  if (ownerIds.length === 0) return;
  const admin = createAdminClient();

  // Only "pending" is safe to delete — a "revoked" row is outstanding work.
  const { error: delErr } = await admin
    .from("content_shares")
    .delete()
    .eq("profile_id", profileId)
    .eq("owner_type", ownerType)
    .eq("status", "pending")
    .in("owner_id", ownerIds);
  if (delErr) console.error("[drive] queueRevokes cleanup failed:", delErr.message);

  const { error } = await admin
    .from("content_shares")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .eq("owner_type", ownerType)
    .eq("status", "shared")
    .in("owner_id", ownerIds);
  if (error) console.error("[drive] queueRevokes failed:", error.message);
}

/**
 * Everything a member is entitled to right now: every session, plus the
 * course she currently has open. Used when access is (re)granted, so a
 * renewal restores her course too — not only the session recordings.
 */
export async function queueEverythingFor(profileId: string): Promise<void> {
  await queueShares(profileId, "session", await allSessionIds());

  const { data: active } = await createAdminClient()
    .from("enrollments")
    .select("course_id")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();
  if (active?.course_id) await queueShares(profileId, "course", [active.course_id]);
}

/** Every session the community shares (a new member gets all of them). */
export async function allSessionIds(): Promise<string[]> {
  const out: string[] = [];
  const admin = createAdminClient();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin.from("sessions").select("id").range(from, from + PAGE - 1);
    out.push(...(data ?? []).map((s) => s.id));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** Members who should have access to community material right now. */
async function activeMemberIds(): Promise<string[]> {
  const out: string[] = [];
  const admin = createAdminClient();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("status", "active")
      .range(from, from + PAGE - 1);
    out.push(...(data ?? []).map((p) => p.id));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** A new session belongs to everyone who's already a member, not just future joiners. */
export async function queueSessionForAllMembers(sessionId: string): Promise<void> {
  const members = await activeMemberIds();
  if (members.length === 0) return;
  const admin = createAdminClient();
  // One bulk write — never a per-member loop that a timeout could cut short.
  const { error } = await admin.from("content_shares").upsert(
    members.map((profile_id) => ({
      owner_type: "session" as const,
      owner_id: sessionId,
      profile_id,
      status: "pending" as const,
      revoked_at: null,
    })),
    { onConflict: "owner_type,owner_id,profile_id" }
  );
  if (error) console.error("[drive] queueSessionForAllMembers failed:", error.message);
}

/** A member is leaving: queue removal of everything she was given. */
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
}

/**
 * Where to share this member's material: the Google address she gave us if
 * she has one, otherwise the address she signed up with.
 */
async function emailOf(profileId: string): Promise<string | null> {
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
async function fileIdsFor(ownerType: ContentOwner, ownerId: string): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("content_links")
    .select("url")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId);
  const ids: string[] = [];
  for (const l of data ?? []) {
    const id = driveFileId(l.url);
    if (id) ids.push(id);
  }
  return ids;
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
  let pendingQuery = admin
    .from("content_shares")
    .select(COLS)
    .eq("status", "pending");
  if (blocked.length > 0) {
    pendingQuery = pendingQuery.not("profile_id", "in", `(${blocked.join(",")})`);
  }

  const [{ data: pendingRows }, { data: revokedRows }] = await Promise.all([
    pendingQuery.order("created_at", { ascending: true }).limit(limit),
    admin
      .from("content_shares")
      .select(COLS)
      .eq("status", "revoked")
      .order("created_at", { ascending: true })
      .limit(limit),
  ]);

  // Revokes first — losing access should never wait behind a backlog of grants.
  const rows = [...(revokedRows ?? []), ...(pendingRows ?? [])].slice(0, limit);
  if (rows.length === 0) return result;

  // Resolve each member's email and each owner's file list once per batch.
  const emails = new Map<string, string | null>();
  const files = new Map<string, string[]>();
  // Members whose address Drive rejected — asked for a Gmail once per batch.
  const askedForGmail = new Set<string>();

  for (const row of rows) {
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
    if (!files.has(key)) files.set(key, await fileIdsFor(row.owner_type, row.owner_id));
    const ids = files.get(key) ?? [];
    if (ids.length === 0) {
      // No Drive links (yet) — nothing to do, leave the row for later.
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
          for (const fileId of ids) await revokeAccess(fileId, grantedTo);
        }
        for (const fileId of ids) await grantReadAccess(fileId, email);
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
        for (const fileId of ids) await revokeAccess(fileId, grantedTo ?? email);
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
    }
  }

  return result;
}
