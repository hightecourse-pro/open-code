"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { updateReportStatus } from "../actions";
import type { ReportStatus, ReportTarget } from "@/types/database";

/**
 * Several members reporting the same post create several rows. The screen
 * shows one card per piece of content, so a decision has to close ALL of that
 * content's open reports — otherwise the siblings stay open and the same item
 * comes back to the queue, now with its body already gone ("התוכן כבר הוסר").
 */
export async function resolveReportsForTarget(
  reportId: string,
  targetType: ReportTarget,
  targetId: string,
  status: ReportStatus
): Promise<void> {
  await requireRole("admin");

  // One representative row does the real work (removing the reported content)
  // so that logic stays in a single place.
  await updateReportStatus(reportId, status);

  // Everything else reported on the same content follows the same decision —
  // including reports that arrived while this screen was open.
  const supabase = await createClient();
  await supabase
    .from("reports")
    .update({ status })
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("status", "open");

  revalidatePath("/admin/moderation");
}
