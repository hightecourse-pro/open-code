"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWaText, waWindowLeftMs } from "@/lib/whatsapp";

/**
 * Send a free-form WhatsApp reply from the admin inbox. Returns an explicit
 * verdict (the chat lesson, 31/8): the UI trusts it instead of guessing.
 * Refuses outside Meta's 24-hour service window — Meta would reject it
 * anyway, with a worse error.
 */
export async function sendWhatsAppReply(
  contactId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole("admin");
  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 4000) return { ok: false, error: "הודעה ריקה או ארוכה מדי" };

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("wa_contacts")
    .select("id, wa_id, last_inbound_at")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return { ok: false, error: "השיחה לא נמצאה" };
  if (waWindowLeftMs(contact.last_inbound_at) <= 0) {
    return {
      ok: false,
      error: "חלון ה-24 שעות של מטא נסגר — אפשר לענות חופשי רק תוך יממה מההודעה האחרונה שלה.",
    };
  }

  const sent = await sendWaText(contact.wa_id, body);
  if (!sent.ok) return { ok: false, error: sent.error };

  await admin.from("wa_messages").insert({
    contact_id: contact.id,
    direction: "out",
    body,
    wa_message_id: sent.waMessageId,
    status: "sent",
    sent_by: me.id,
  });
  await admin
    .from("wa_contacts")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", contact.id);
  revalidatePath("/admin/whatsapp");
  return { ok: true };
}
