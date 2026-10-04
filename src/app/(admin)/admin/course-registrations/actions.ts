"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type CourseRegistrationStatus = "registered" | "paid" | "canceled";

/** Team bookkeeping on a registrant: paid (confirmed by Shufra) / canceled / note. */
export async function updateCourseRegistration(
  id: string,
  patch: { status?: CourseRegistrationStatus; notes?: string }
): Promise<{ error?: string }> {
  await requireRole("admin");
  const admin = createAdminClient();
  const row: Database["public"]["Tables"]["course_registrations"]["Update"] = { updated_at: new Date().toISOString() };
  if (patch.status) {
    if (!["registered", "paid", "canceled"].includes(patch.status)) return { error: "סטטוס לא מוכר" };
    row.status = patch.status;
    row.paid_at = patch.status === "paid" ? new Date().toISOString() : null;
  }
  if (patch.notes !== undefined) row.notes = patch.notes.trim() || null;
  const { error } = await admin.from("course_registrations").update(row).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/course-registrations");
  return {};
}

export async function deleteCourseRegistration(id: string): Promise<{ error?: string }> {
  await requireRole("admin");
  const { error } = await createAdminClient().from("course_registrations").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/course-registrations");
  return {};
}
