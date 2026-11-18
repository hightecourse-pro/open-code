"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOrder, markConferenceOrderPaid, syncOrderToSheet, updateSheetPaymentCells } from "@/lib/conference";
import { PATHS, type OrderStatus } from "@/lib/conference-shared";

const STATUSES: OrderStatus[] = ["pending", "paid_reported", "paid", "awaiting_transfer", "canceled"];

/** Team bookkeeping on an order: paid (a transfer that arrived, a card charge verified by hand) / canceled / a note. */
export async function updateConferenceOrder(id: string, patch: { status?: OrderStatus; adminNote?: string }): Promise<{ error?: string }> {
  await requireRole("admin");
  const order = await loadOrder({ id });
  if (!order) return { error: "ההרשמה לא נמצאה." };
  const admin = createAdminClient();
  if (patch.adminNote !== undefined) {
    const { error } = await admin.from("conference_orders").update({ admin_note: patch.adminNote.trim() || null, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return { error: error.message };
  }
  if (patch.status) {
    if (!STATUSES.includes(patch.status)) return { error: "סטטוס לא מוכר" };
    if (patch.status === "paid") {
      await markConferenceOrderPaid(order, { transactionId: order.nedarim_transaction_id, amountAgorot: order.payment_amount_agorot, by: "manual" });
    } else {
      const { error } = await admin
        .from("conference_orders")
        .update({ status: patch.status, paid_at: null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return { error: error.message };
      const fresh = await loadOrder({ id });
      if (fresh) await updateSheetPaymentCells(fresh);
    }
  }
  revalidatePath(PATHS.admin);
  return {};
}

/** The sheet append failed (or never ran): try again. */
export async function resyncConferenceSheet(id: string): Promise<{ error?: string }> {
  await requireRole("admin");
  const r = await syncOrderToSheet(id);
  revalidatePath(PATHS.admin);
  return r.ok ? {} : { error: r.error ?? "לא נכתב" };
}

/** Removes the order and its participants from the database. The sheet's rows stay - the admin deletes them by hand. */
export async function deleteConferenceOrder(id: string): Promise<{ error?: string }> {
  await requireRole("admin");
  const { error } = await createAdminClient().from("conference_orders").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(PATHS.admin);
  return {};
}
