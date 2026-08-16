// Every entry into course/session material, written to `content_views`.
//
// Two rules keep this honest:
//   1. It never throws. A member watching a video must not lose the video
//      because the log had a bad day — every failure is swallowed and logged.
//   2. It degrades. The owner columns (owner_type / owner_id / source) arrive
//      with supabase/_content_access_log.sql; until that runs, the insert
//      falls back to the legacy {link_id, profile_id} shape, and an
//      owner-level open with no link is simply skipped.
//
// De-duplication: the course iframe's onLoad fires on every mount and every
// re-render, so a single visit could otherwise log a handful of "views" and
// make "כמה פעמים" meaningless. One open per member per content per 30
// minutes is counted. Deliberately a query and not a unique index — a real
// second viewing tomorrow must still be counted.

import { createAdminClient } from "@/lib/supabase/admin";
import type { ContentOwner } from "@/types/database";

/** How she got in — the admin screens read this back as plain Hebrew. */
export type OpenSource = "unlock" | "embed" | "open";

export interface ContentOpenInput {
  ownerType: ContentOwner;
  ownerId: string;
  /** The specific video/folder, when the open was of one link. */
  linkId?: string | null;
  source?: OpenSource;
}

/** Two opens of the same thing inside this window count as one visit. */
const THROTTLE_MS = 30 * 60 * 1000;

/**
 * "That column isn't there" — i.e. the migration hasn't run yet. Two different
 * errors say it: a *filter* on an unknown column reaches Postgres and comes
 * back 42703, but an *insert* with an unknown key never gets that far —
 * PostgREST rejects it from its own schema cache as PGRST204 ("Could not find
 * the 'owner_type' column of 'content_views' in the schema cache"). Matching
 * only the Postgres shape would kill the fallback below on exactly the call
 * that needs it, so keep this loose — the same idiom used by the other
 * pre-migration guards (admin/clients/actions.ts:22, cv/actions.ts:18).
 */
function isMissingColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    /column/i.test(err.message ?? "")
  );
}

/**
 * Record that `profileId` opened this content. Safe to call from anywhere,
 * including inside a click handler's transition — it awaits nothing the member
 * can see and swallows every error.
 */
export async function recordContentOpen(
  profileId: string,
  input: ContentOpenInput
): Promise<void> {
  const admin = createAdminClient();
  const linkId = input.linkId ?? null;

  try {
    // --- throttle: did she already open this in the last half hour? --------
    const since = new Date(Date.now() - THROTTLE_MS).toISOString();
    let recent = admin
      .from("content_views")
      .select("id")
      .eq("profile_id", profileId)
      .gte("created_at", since)
      .limit(1);
    recent = linkId
      ? recent.eq("link_id", linkId)
      : recent.eq("owner_type", input.ownerType).eq("owner_id", input.ownerId);

    const { data: already, error: recentErr } = await recent;
    // A pre-migration owner-level lookup errors on the missing column; that's
    // fine — there is nothing to insert in that case either (see below).
    if (!recentErr && (already ?? []).length > 0) return;

    // --- the real row -----------------------------------------------------
    const { error } = await admin.from("content_views").insert({
      link_id: linkId,
      profile_id: profileId,
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      source: input.source ?? "open",
    });
    if (!error) return;

    if (!isMissingColumn(error)) {
      console.error("[views] log failed:", error.message);
      return;
    }

    // --- pre-migration fallback ------------------------------------------
    // Without the owner columns there is nowhere to put an owner-level open,
    // and link_id is still NOT NULL. Log what we can, drop what we can't.
    if (!linkId) return;
    const { error: legacyErr } = await admin
      .from("content_views")
      .insert({ link_id: linkId, profile_id: profileId });
    if (legacyErr) console.error("[views] legacy log failed:", legacyErr.message);
  } catch (e) {
    console.error("[views] log threw:", e);
  }
}
