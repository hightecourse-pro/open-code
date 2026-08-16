"use server";

// The two things a member's click can ask for: open my access to this, and
// write down that I came in. Both re-derive who she is from the session —
// never from an argument — because a server action is a POST endpoint.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureAccess, type AccessResult } from "@/lib/content-access";
import { recordContentOpen, type OpenSource } from "@/lib/content-log";
import type { ContentOwner } from "@/types/database";

/** Narrow whatever arrived over the wire to the two owners we know. */
function asOwner(raw: string): ContentOwner {
  return raw === "session" ? "session" : "course";
}

/**
 * She pressed "צפייה". Give her real Drive access to this course/session, or
 * come back with a reason the screen can say out loud.
 */
export async function unlockContent(
  ownerTypeRaw: ContentOwner,
  ownerId: string
): Promise<AccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "not_entitled" };

  const ownerType = asOwner(ownerTypeRaw);
  const result = await ensureAccess(user.id, ownerType, ownerId);

  if (result.ok) {
    revalidatePath(ownerType === "session" ? "/recordings" : "/courses");
  }
  return result;
}

/**
 * Write down an entry. Fire-and-forget from the client — it never throws and
 * never blocks what she was opening.
 */
export async function logContentOpen(input: {
  ownerType: ContentOwner;
  ownerId: string;
  linkId?: string | null;
  source?: OpenSource;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await recordContentOpen(user.id, {
    ownerType: asOwner(input.ownerType),
    ownerId: input.ownerId,
    linkId: input.linkId ?? null,
    source: input.source,
  });
}

/**
 * A member opened a course video. Kept as its own action because the course
 * screen calls it per link — it resolves the link's owner so the entry is
 * attributed to the course even if the link is deleted later.
 */
export async function recordView(linkId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: link } = await supabase
    .from("content_links")
    .select("owner_type, owner_id")
    .eq("id", linkId)
    .maybeSingle();
  if (!link) return;

  await recordContentOpen(user.id, {
    ownerType: link.owner_type,
    ownerId: link.owner_id,
    linkId,
    source: "embed",
  });
}
