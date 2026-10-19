"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/unsubscribe";

/** The team lets her hear from us again (she asked, or it was a mistake). */
export async function restoreEmails(email: string): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  const e = normalizeEmail(email);
  const { data: row } = await admin.from("email_opt_outs").select("profile_id, kind").eq("email", e).maybeSingle();
  await admin.from("email_opt_outs").delete().eq("email", e);
  if (row?.profile_id && row.kind === "emails") await admin.from("profiles").update({ digest_frequency: "daily" }).eq("id", row.profile_id);
  revalidatePath("/admin/departures");
}

/** Back into the community, to the status she had before she left. */
export async function restoreMember(profileId: string): Promise<void> {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("status, left_from_status").eq("id", profileId).maybeSingle();
  if (!p || p.status !== "left") return;
  const back = (["active", "pending", "paused"].includes(p.left_from_status ?? "") ? p.left_from_status : "pending") as "active" | "pending" | "paused";
  await admin.from("profiles").update({ status: back, left_at: null, left_reason: null, left_from_status: null, digest_frequency: "daily" }).eq("id", profileId);
  await admin.from("email_opt_outs").delete().eq("profile_id", profileId);
  revalidatePath("/admin/departures");
  revalidatePath("/admin/members");
}
