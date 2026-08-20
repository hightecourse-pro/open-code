"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

/** Mark one alert as read. Goes through the user client — RLS is the gate. */
export async function markAlertRead(id: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.from("admin_alerts").update({ read_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/admin/alerts");
  revalidatePath("/admin", "layout"); // the sidebar badge
}

/** Mark everything unread as read. */
export async function markAllAlertsRead(): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase
    .from("admin_alerts")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  revalidatePath("/admin/alerts");
  revalidatePath("/admin", "layout");
}
