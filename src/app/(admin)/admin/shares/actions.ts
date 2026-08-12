"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

/**
 * Take a live share back. Marking it "revoked" is exactly what the engine does
 * (src/lib/drive-shares.ts:82) — the sync worker then removes the access in
 * Drive, so the row stays visible in the queue until that actually happened.
 */
export async function revokeShare(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("content_shares")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "shared");
  revalidatePath("/admin/shares");
}
