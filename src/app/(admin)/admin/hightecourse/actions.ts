"use server";

import { revalidatePath } from "next/cache";
import { requireHcAccess } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOrder, markConferenceOrderPaid, syncOrderToSheet, updateSheetPaymentCells } from "@/lib/conference";
import { PATHS, type OrderStatus } from "@/lib/conference-shared";
import { PATHS as HC } from "@/app/hightecourse/config";

const STATUSES: OrderStatus[] = ["pending", "paid_reported", "paid", "awaiting_transfer", "canceled"];

/** Both doors of the screen: the Open Code admin and מערכת ניהול הייטקורס (22/11). */
const revalidateConference = () => {
  revalidatePath(PATHS.admin);
  revalidatePath(HC.day3);
};

/** Team bookkeeping on an order: paid (a transfer that arrived, a card charge verified by hand) / canceled / a note. */
export async function updateConferenceOrder(id: string, patch: { status?: OrderStatus; adminNote?: string }): Promise<{ error?: string }> {
  await requireHcAccess();
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
  revalidateConference();
  return {};
}

/** The sheet append failed (or never ran): try again. */
export async function resyncConferenceSheet(id: string): Promise<{ error?: string }> {
  await requireHcAccess();
  const r = await syncOrderToSheet(id);
  revalidateConference();
  return r.ok ? {} : { error: r.error ?? "לא נכתב" };
}

/** Removes the order and its participants from the database. The sheet's rows stay - the admin deletes them by hand. */
export async function deleteConferenceOrder(id: string): Promise<{ error?: string }> {
  await requireHcAccess();
  const { error } = await createAdminClient().from("conference_orders").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidateConference();
  return {};
}
