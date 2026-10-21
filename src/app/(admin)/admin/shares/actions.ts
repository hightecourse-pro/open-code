"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import type { ContentOwner } from "@/types/database";

export type ShareFormState = { ok?: string; error?: string };

export interface MemberHit {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
}

/**
 * Members for the manual-share picker, as the admin types (the owner, 21/10:
 * the old <select> held the first 300 names of ~1,200). Name or email, any
 * status except rejected/left - she decides whom to share with; the status
 * tag tells her what she is looking at. Email search goes through the
 * member_emails RPC (auth.users is not readable from the client).
 */
export async function searchMembersForShare(q: string): Promise<MemberHit[]> {
  await requireRole("admin");
  const needle = q.trim().slice(0, 60);
  if (needle.length < 2) return [];
  const admin = createAdminClient();
  const byName = await admin
    .from("profiles")
    .select("id, full_name, status")
    .not("status", "in", "(rejected,left)")
    .ilike("full_name", `%${needle.replace(/[%_]/g, "")}%`)
    .order("full_name")
    .limit(20);
  const rows = new Map<string, { id: string; full_name: string; status: string }>();
  for (const r of byName.data ?? []) rows.set(r.id, r);
  if (needle.includes("@") || /^[a-z0-9._-]+$/i.test(needle)) {
    // looks like (part of) an address: the RPC gives emails for ids, so we
    // search the address list of every live member once, server-side.
    const { data: ids } = await admin.from("profiles").select("id, full_name, status").not("status", "in", "(rejected,left)").limit(5000);
    const all = ids ?? [];
    for (let i = 0; i < all.length && rows.size < 20; i += 500) {
      const chunk = all.slice(i, i + 500);
      const { data: emails } = await admin.rpc("member_emails", { p_ids: chunk.map((p) => p.id) });
      for (const e of (emails ?? []) as { id: string; email: string | null }[]) {
        if (e.email && e.email.toLowerCase().includes(needle.toLowerCase())) {
          const p = chunk.find((x) => x.id === e.id);
          if (p && !rows.has(p.id)) rows.set(p.id, p);
          if (rows.size >= 20) break;
        }
      }
    }
  }
  const list = [...rows.values()].slice(0, 20);
  if (list.length === 0) return [];
  const { data: emails } = await admin.rpc("member_emails", { p_ids: list.map((p) => p.id) });
  const emailOf = new Map(((emails ?? []) as { id: string; email: string | null }[]).map((e) => [e.id, e.email]));
  return list.map((p) => ({ id: p.id, full_name: p.full_name, email: emailOf.get(p.id) ?? null, status: p.status }));
}

/**
 * Hand a member an extra course/session on purpose - outside the
 * one-course-at-a-time model. The row is flagged granted_manually, which
 * exempts it from the monthly course swap (queueRevokes) and nothing else:
 * an admin can take it back with removeShare below, and leaving the community
 * takes it back by itself (queueRevokeAll - no exception for manual rows).
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
  // "pending" would send the Drive worker to re-grant something she has -
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
        return { error: "לא הצלחנו לסמן את השיתוף כאישי - ננסה שוב?" };
      }
    }
    revalidatePath("/admin/shares");
    revalidatePath("/courses");
    return { ok: "התוכן כבר פתוח עבורה - סימנו אותו כשיתוף אישי ✓" };
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
    return { error: "לא הצלחנו לפתוח לה את התוכן - ננסה שוב?" };
  }

  revalidatePath("/admin/shares");
  revalidatePath("/courses");
  return { ok: "פתחנו לה את התוכן ✓ הוא מופיע עכשיו ב״מה משותף למי״." };
}

/**
 * Take a share back. A live one becomes "revoked" - the same state the engine
 * uses (src/lib/drive-shares.ts:82) - so the worker removes the access in
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
