"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import type { ContentOwner } from "@/types/database";

export type ShareFormState = { ok?: string; error?: string };

/**
 * Hand a member an extra course/session on purpose — outside the
 * one-course-at-a-time model. The row is flagged granted_manually so nothing
 * automatic takes it away: only an admin can, with removeShare below.
 *
 * Queued as "pending", exactly like an automatic share, so the same Drive
 * worker performs it (or the manual queue shows it when automation is off).
 */
export async function grantShareManually(
  _prev: ShareFormState,
  formData: FormData
): Promise<ShareFormState> {
  await requireRole("admin");
  const profileId = String(formData.get("profile_id") ?? "").trim();
  // The content picker sends one value: "course:<id>" / "session:<id>".
  const [ownerTypeRaw, ownerId] = String(formData.get("content") ?? "").split(":");
  const ownerType: ContentOwner = ownerTypeRaw === "session" ? "session" : "course";
  if (!profileId || !ownerId) return { error: "צריך לבחור גם משתתפת וגם תוכן לשיתוף." };

  const admin = createAdminClient();

  // She may already hold this content automatically. Re-queueing it as
  // "pending" would send the Drive worker to re-grant something she has —
  // so an existing live row is only FLAGGED as manual, never reset.
  const { data: existing } = await admin
    .from("content_shares")
    .select("id, status, granted_manually")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing?.status === "shared") {
    if (!existing.granted_manually) {
      const { error } = await admin
        .from("content_shares")
        .update({ granted_manually: true })
        .eq("id", existing.id);
      if (error) {
        console.error("[drive] manual flag failed:", error.message);
        return { error: "לא הצלחנו לסמן את השיתוף כאישי — ננסה שוב?" };
      }
    }
    revalidatePath("/admin/shares");
    revalidatePath("/courses");
    return { ok: "התוכן כבר פתוח עבורה — סימנו אותו כשיתוף אישי ✓" };
  }

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
  if (error) {
    console.error("[drive] manual grant failed:", error.message);
    return { error: "לא הצלחנו לפתוח לה את התוכן — ננסה שוב?" };
  }

  revalidatePath("/admin/shares");
  revalidatePath("/courses");
  return { ok: "פתחנו לה את התוכן ✓ הוא מופיע עכשיו ב״מה משותף למי״." };
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
