// Access on attempt: a member gets Drive access the moment she opens
// something, not the moment she joins.
//
// The old model pushed — joining fanned a member out across every session,
// publishing a session fanned it out across every member. M×N rows for
// material nobody had asked for, and every one of them to undo on leaving.
// This pulls instead: `ensureAccess` writes exactly one row, for exactly the
// thing she pressed, and `queueRevokeAll` therefore takes back exactly what
// she really opened.
//
// The queue is still the safety net, never the engine: the row is written
// `pending` BEFORE any Google call, so a Drive outage (or a process that dies
// mid-grant) degrades to yesterday's behaviour — the worker finishes the job —
// instead of to a broken page.

import { createAdminClient } from "@/lib/supabase/admin";
import { isProductionEnv } from "@/lib/env";
import { isSubscriber } from "@/lib/auth";
import {
  NotAGoogleAccountError,
  grantReadAccess,
  isDriveAutomationConfigured,
} from "@/lib/drive-api";
import { emailOf, fileIdsFor, queueShares } from "@/lib/drive-shares";
import { recordContentOpen } from "@/lib/content-log";
import type { ContentOwner, Profile } from "@/types/database";

export type AccessResult =
  | { ok: true; alreadyHad: boolean }
  | { ok: false; reason: "not_entitled" }
  | { ok: false; reason: "needs_google_email" }
  | { ok: false; reason: "queued" };

/**
 * May she open session recordings at all? Paying members, mentors and the
 * team — the rule the Drive automation has always used. Sessions the team
 * opened to the whole community bypass this (see `canAccess`).
 *
 * Exported so the screen and the grant agree: a button that refuses when you
 * press it is worse than no button.
 */
export function mayOpenSessions(
  profile: Pick<Profile, "status" | "member_tier" | "role">
): boolean {
  if (profile.status !== "active") return false;
  return (
    profile.member_tier === "paid" || profile.role === "mentor" || profile.role === "admin"
  );
}

/**
 * Is she entitled to this content right now? Re-checked here, at the moment of
 * access, because a server action is a POST endpoint anyone can call — the UI
 * gate is decoration, this is the rule.
 */
export async function canAccess(
  profileId: string,
  ownerType: ContentOwner,
  ownerId: string
): Promise<boolean> {
  const admin = createAdminClient();

  if (ownerType === "session") {
    const [{ data: session }, { data: profile }] = await Promise.all([
      admin.from("sessions").select("open_to_all").eq("id", ownerId).maybeSingle(),
      admin.from("profiles").select("status, member_tier, role").eq("id", profileId).maybeSingle(),
    ]);
    if (!session || !profile) return false;
    if (profile.status === "rejected") return false;
    // Opened to the whole community → every member OF the community. Approved
    // membership is still the floor: it is what the old `sessionAudienceIds`
    // required (drive-shares.ts:141), so a signup still waiting for approval
    // never gets a Drive permission, and a member whose subscription ended
    // can't press her way back in after `queueRevokeAll` took it away.
    if (session.open_to_all) return profile.status === "active";
    return mayOpenSessions(profile);
  }

  // A course: her active enrolment on THIS course, or a share an admin opened
  // for her personally (which outlives the monthly swap). Membership is the
  // floor for both — nothing ever ends an enrolment when she leaves, so on a
  // stale `active` row alone a paused/pending profile would walk straight back
  // through the door `queueRevokeAll` just closed. Same rule `startCourse`
  // enforces, so the button and the grant agree.
  const [{ data: profile }, { data: enrolment }, { data: manual }] = await Promise.all([
    admin.from("profiles").select("status, role").eq("id", profileId).maybeSingle(),
    admin
      .from("enrollments")
      .select("id")
      .eq("profile_id", profileId)
      .eq("course_id", ownerId)
      .eq("status", "active")
      .maybeSingle(),
    admin
      .from("content_shares")
      .select("id")
      .eq("profile_id", profileId)
      .eq("owner_type", "course")
      .eq("owner_id", ownerId)
      .eq("granted_manually", true)
      .neq("status", "revoked")
      .maybeSingle(),
  ]);
  if (!profile || !isSubscriber(profile)) return false;
  return !!enrolment || !!manual;
}

/**
 * She is trying to open this content. Check she may, then actually give her
 * Drive access — and log the entry.
 *
 * Never throws: every Drive failure is mapped to a result the screen has a
 * sentence for, and leaves the row `pending` for the worker to retry.
 */
export async function ensureAccess(
  profileId: string,
  ownerType: ContentOwner,
  ownerId: string
): Promise<AccessResult> {
  // 1. Entitlement. Refused → no row is written at all.
  if (!(await canAccess(profileId, ownerType, ownerId))) {
    return { ok: false, reason: "not_entitled" };
  }

  const admin = createAdminClient();

  // 2. Already hers? Idempotent — this is also the double-click and the
  //    two-open-tabs answer.
  const { data: existing } = await admin
    .from("content_shares")
    .select("id, status, granted_email")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (existing?.status === "shared") {
    await recordContentOpen(profileId, { ownerType, ownerId, source: "unlock" });
    return { ok: true, alreadyHad: true };
  }

  /**
   * The address this row was last granted to. When she has changed her Drive
   * address since, the OLD one still holds the permission — granting the new
   * one here and overwriting granted_email would strand that access with no
   * row pointing at it, so nothing could ever take it back (not even leaving
   * the community). Re-pointing is the worker's job, which revokes the old
   * address first; hand it over rather than half-doing it here.
   */
  const grantedTo = existing?.granted_email ?? null;

  // 3. The queue row goes in BEFORE Google is touched. If anything below dies,
  //    the daily worker still finishes the job — and a grant with no row
  //    behind it would be access nobody could ever take back.
  if (!(await queueShares(profileId, ownerType, [ownerId]))) {
    return { ok: false, reason: "queued" };
  }

  // 4. No Google credentials — the admin shares by hand from /admin/shares.
  if (!isDriveAutomationConfigured()) return { ok: false, reason: "queued" };

  // 4b. Outside production nothing touches Google — the same service account
  //     holds the REAL course folders in both environments (owner decision),
  //     so a staging click must stop at the queue row it just wrote. She sees
  //     "the request was recorded", which is exactly the truth.
  if (!isProductionEnv()) return { ok: false, reason: "queued" };

  // 5. Where to share it.
  const email = await emailOf(profileId);
  if (!email) return { ok: false, reason: "queued" };

  // A changed address: the row stays pending and the worker performs the move
  // (revoke the old, grant the new) as one operation. See grantedTo above.
  if (grantedTo && grantedTo.toLowerCase() !== email.toLowerCase()) {
    return { ok: false, reason: "queued" };
  }

  // 6. Every file of this owner at once. Sequentially, a course with five
  //    links would be 5 × 15s inside her click — past any serverless budget.
  const ids = await fileIdsFor(ownerType, ownerId);
  if (ids.length === 0) {
    // Nothing here needs a Drive permission (no Drive links yet, or none of
    // them are Drive URLs). Not a failure — don't spin forever on it.
    await recordContentOpen(profileId, { ownerType, ownerId, source: "unlock" });
    return { ok: true, alreadyHad: false };
  }

  const settled = await Promise.allSettled(ids.map((id) => grantReadAccess(id, email)));
  const failures = settled.filter((r) => r.status === "rejected");

  if (failures.length > 0) {
    // Partial success still leaves the row pending — the worker completes it.
    const needsGoogle = failures.some(
      (f) => (f as PromiseRejectedResult).reason instanceof NotAGoogleAccountError
    );
    for (const f of failures.slice(0, 3)) {
      console.error(
        `[access] grant failed (${ownerType}:${ownerId} → ${email}):`,
        (f as PromiseRejectedResult).reason
      );
    }
    // Her address can't hold a Drive share. Don't email her from here — she is
    // standing in front of the fix, and the screen sends her to /profile.
    return { ok: false, reason: needsGoogle ? "needs_google_email" : "queued" };
  }

  // 7. All granted.
  const { error: doneErr } = await admin
    .from("content_shares")
    .update({
      status: "shared",
      shared_at: new Date().toISOString(),
      granted_email: email,
    })
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .eq("profile_id", profileId);
  if (doneErr) console.error("[access] mark shared failed:", doneErr.message);

  // 8. And it counts as an entry.
  await recordContentOpen(profileId, { ownerType, ownerId, source: "unlock" });
  return { ok: true, alreadyHad: false };
}
