"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { markRegistrationPaid, REG_PAYMENT_COLS, type RegForPayment } from "@/lib/course-payment";
import type { Database } from "@/types/database";

export type CourseRegistrationStatus = "registered" | "paid_reported" | "paid" | "canceled";

/** Team bookkeeping on a registrant: paid (confirmed by Shufra) / canceled / note. */
export async function updateCourseRegistration(
  id: string,
  patch: { status?: CourseRegistrationStatus; notes?: string }
): Promise<{ error?: string }> {
  await requireRole("admin");
  const admin = createAdminClient();
  const row: Database["public"]["Tables"]["course_registrations"]["Update"] = { updated_at: new Date().toISOString() };
  if (patch.status) {
    if (!["registered", "paid_reported", "paid", "canceled"].includes(patch.status)) return { error: "סטטוס לא מוכר" };
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

/**
 * A course payment the callback could not match, attached by hand to a
 * registration - from here on it is exactly as if the code had been in the
 * comment: paid ✓ with the money on it, alert, mail to Shufra and the office,
 * confirmation to her (once).
 */
export async function attachCoursePayment(paymentId: string, registrationId: string): Promise<{ error?: string }> {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("course_payments")
    .select("id, transaction_id, amount_agorot, installments, phone, registration_id, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!pay) return { error: "התשלום לא נמצא." };
  if (pay.registration_id) return { error: "התשלום הזה כבר משויך להרשמה." };
  if (pay.status !== "ok") return { error: "אפשר לשייך רק תשלום שהצליח." };
  const { data: reg } = await admin.from("course_registrations").select(REG_PAYMENT_COLS).eq("id", registrationId).maybeSingle();
  if (!reg) return { error: "ההרשמה לא נמצאה." };

  const { error } = await admin.from("course_payments").update({ registration_id: reg.id, matched_by: "manual" }).eq("id", pay.id);
  if (error) return { error: error.message };
  await markRegistrationPaid(
    reg as RegForPayment,
    { transactionId: pay.transaction_id, amountAgorot: pay.amount_agorot, installments: pay.installments ?? 1, phone: pay.phone },
    "manual"
  );
  revalidatePath("/admin/course-registrations");
  return {};
}
