"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * She has now looked at these celebrations (the owner, 18/9): the "חדש"
 * marks drop from her next page load and the banner stops opening by itself
 * until a NEW name appears. Idempotent — the set only grows.
 */
export async function markHiresSeen(hireIds: string[]): Promise<void> {
  const ids = hireIds.filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  if (ids.length === 0) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("hire_banner_seen")
    .select("seen_hire_ids")
    .eq("profile_id", user.id)
    .maybeSingle();
  const merged = [...new Set([...(row?.seen_hire_ids ?? []), ...ids])];
  await admin.from("hire_banner_seen").upsert(
    { profile_id: user.id, seen_hire_ids: merged, updated_at: new Date().toISOString() },
    { onConflict: "profile_id" }
  );
}
