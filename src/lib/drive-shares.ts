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
import { grantReadAccess, isDriveAutomationConfigured, revokeAccess } from "@/lib/drive-api";
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
}

async function emailOf(profileId: string): Promise<string | null> {
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(profileId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
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
  };
  if (!result.configured) return result;

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("content_shares")
    .select("id, owner_type, owner_id, profile_id, status")
    .in("status", ["pending", "revoked"])
    .order("created_at", { ascending: true })
    .limit(limit);
  if (!rows?.length) return result;

  // Resolve each member's email and each owner's file list once per batch.
  const emails = new Map<string, string | null>();
  const files = new Map<string, string[]>();

  for (const row of rows) {
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

    try {
      if (row.status === "pending") {
        for (const fileId of ids) await grantReadAccess(fileId, email);
        await admin
          .from("content_shares")
          .update({ status: "shared", shared_at: new Date().toISOString() })
          .eq("id", row.id);
        result.granted++;
      } else {
        for (const fileId of ids) await revokeAccess(fileId, email);
        // Fully undone → the audit row has served its purpose.
        await admin.from("content_shares").delete().eq("id", row.id);
        result.revoked++;
      }
    } catch (e) {
      // Left in place: retried next run, and visible in the manual queue.
      result.failed++;
      console.error(`[drive] ${row.status} failed (${key} → ${email}):`, e);
    }
  }

  return result;
}
