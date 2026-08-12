"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import type { ContentOwner } from "@/types/database";

/**
 * Hand a member an extra course/session on purpose — outside the
 * one-course-at-a-time model. The row is flagged granted_manually so nothing
 * automatic takes it away: only an admin can, with removeShare below.
 *
 * Queued as "pending", exactly like an automatic share, so the same Drive
 * worker performs it (or the manual queue shows it when automation is off).
 */
export async function grantShareManually(formData: FormData): Promise<void> {
  await requireRole("admin");
  const profileId = String(formData.get("profile_id") ?? "").trim();
  // The content picker sends one value: "course:<id>" / "session:<id>".
  const [ownerTypeRaw, ownerId] = String(formData.get("content") ?? "").split(":");
  const ownerType: ContentOwner = ownerTypeRaw === "session" ? "session" : "course";
  if (!profileId || !ownerId) return;

  const admin = createAdminClient();
  const { error } = await admin.from("content_shares").upsert(
    {
      profile_id: profileId,
      owner_type: ownerType,
      owner_id: ownerId,
      status: "pending" as const,
      revoked_at: null,
      granted_manually: true,
    },
    { onConflict: "owner_type,owner_id,profile_id" }
  );
  if (error) console.error("[drive] manual grant failed:", error.message);

  revalidatePath("/admin/shares");
  revalidatePath("/courses");
}

/**
 * Take a share back. A live one becomes "revoked" — the same state the engine
 * uses (src/lib/drive-shares.ts:82) — so the worker removes the access in
 * Drive. One that was never granted is simply dropped: there is nothing to undo.
 */
export async function removeShare(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("content_shares")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;

  if (row.status === "shared") {
    await supabase
      .from("content_shares")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", id);
  } else {
    await supabase.from("content_shares").delete().eq("id", id);
  }

  revalidatePath("/admin/shares");
  revalidatePath("/courses");
}
