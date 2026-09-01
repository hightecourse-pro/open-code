"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listWaTemplates,
  sendWaMedia,
  sendWaTemplate,
  sendWaText,
  toWaId,
  uploadWaMedia,
  waKindOfMime,
  waWindowLeftMs,
} from "@/lib/whatsapp";

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

/** Vercel's serverless request cap is ~4.5MB — stay safely under it. */
const MAX_WA_FILE_BYTES = 4 * 1024 * 1024;

/**
 * Send a file — image, video, audio (voice note), or document — inside the
 * 24h window. The file also lands in our bucket so the thread shows it.
 */
export async function sendWhatsAppMedia(
  contactId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const me = await requireRole("admin");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "לא נבחר קובץ" };
  if (file.size > MAX_WA_FILE_BYTES) return { ok: false, error: "הקובץ גדול מדי — עד 4MB" };
  const caption = String(formData.get("caption") ?? "").trim().slice(0, 1024);

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("wa_contacts")
    .select("id, wa_id, last_inbound_at")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return { ok: false, error: "השיחה לא נמצאה" };
  if (waWindowLeftMs(contact.last_inbound_at) <= 0) {
    return { ok: false, error: "חלון ה-24 שעות של מטא נסגר — קבצים אפשר לשלוח רק בתוכו." };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = (file.type || "application/octet-stream").split(";")[0];
  const kind = waKindOfMime(mime);
  const up = await uploadWaMedia(buf, mime, file.name || "file");
  if (!up.ok) return { ok: false, error: `מטא סירבו לקובץ: ${up.error}` };
  const sent = await sendWaMedia(contact.wa_id, kind, up.mediaId, {
    caption: caption || undefined,
    filename: file.name || undefined,
  });
  if (!sent.ok) return { ok: false, error: sent.error };

  // Our copy, for the thread display (Meta's media links expire).
  const ext = (file.name?.split(".").pop() ?? "bin").replace(/[^\w]/g, "").slice(0, 8) || "bin";
  const path = `${contact.wa_id}/out-${sent.waMessageId.replace(/[^\w.-]/g, "_")}.${ext}`;
  await admin.storage.from("wa-media").upload(path, buf, { contentType: mime, upsert: true });

  await admin.from("wa_messages").insert({
    contact_id: contact.id,
    direction: "out",
    body: caption || (kind === "audio" ? "[הקלטה קולית]" : file.name || "[קובץ]"),
    kind,
    media_path: path,
    media_mime: mime,
    filename: kind === "document" ? file.name ?? null : null,
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

/**
 * Open a conversation with an APPROVED template — the only door Meta allows
 * outside the 24h window (the owner, 1/9: "בפתיחת שיחה חדשה... רק מתוך
 * תבניות"). Recipient is a free number or a member picked from the list.
 */
export async function startTemplateConversation(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  contactId?: string;
}> {
  const me = await requireRole("admin");
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const templateName = String(formData.get("template") ?? "").trim();
  const params: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const v = formData.get(`param${i}`);
    if (v === null) break;
    params.push(String(v).trim());
  }
  const waId = toWaId(phoneRaw);
  if (!waId) return { ok: false, error: "המספר לא נראה תקין" };
  if (!templateName) return { ok: false, error: "יש לבחור תבנית" };
  if (params.some((p) => !p)) return { ok: false, error: "יש למלא את כל השדות של התבנית" };

  const templates = await listWaTemplates();
  const tpl = templates.find((t) => t.name === templateName && t.status === "APPROVED");
  if (!tpl) return { ok: false, error: "התבנית לא נמצאה או שעדיין לא אושרה על ידי מטא" };
  if (params.length !== tpl.paramCount) return { ok: false, error: "מספר השדות לא תואם לתבנית" };

  const sent = await sendWaTemplate(waId, tpl.name, tpl.language, params);
  if (!sent.ok) return { ok: false, error: sent.error };

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("wa_contacts")
    .upsert({ wa_id: waId, last_message_at: new Date().toISOString() }, { onConflict: "wa_id" })
    .select("id")
    .single();
  if (!contact) return { ok: false, error: "השיחה נשלחה אך לא נשמרה — רענני" };

  // The rendered text, so the thread shows what she actually received.
  const rendered = tpl.bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? "");
  await admin.from("wa_messages").insert({
    contact_id: contact.id,
    direction: "out",
    body: rendered.slice(0, 4000),
    kind: "template",
    template_name: tpl.name,
    template_params: params as unknown as import("@/types/database").Json,
    wa_message_id: sent.waMessageId,
    status: "sent",
    sent_by: me.id,
  });
  revalidatePath("/admin/whatsapp");
  return { ok: true, contactId: contact.id };
}
