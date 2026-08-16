"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

/**
 * Reschedule a session. The form sends an ISO instant already resolved from the
 * Israel wall clock the admin typed (see `israelLocalToIso`), so nothing here
 * depends on the server's zone — a bare `new Date("2026-08-20T19:00")` on a UTC
 * host is exactly the bug this replaces.
 */
export async function updateSessionSchedule(sessionId: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const iso = String(formData.get("scheduled_at") ?? "").trim();
  const at = new Date(iso);
  // A malformed value silently does nothing rather than writing "Invalid Date".
  if (!iso || Number.isNaN(at.getTime())) return;

  const supabase = await createClient();
  await supabase.from("sessions").update({ scheduled_at: at.toISOString() }).eq("id", sessionId);
  revalidatePath("/admin/sessions");
  revalidatePath("/admin/content");
  revalidatePath("/events");
  revalidatePath("/recordings");
}
