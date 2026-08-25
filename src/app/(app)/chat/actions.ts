"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, isSubscriber } from "@/lib/auth";
import { sendResendEmail } from "@/lib/email/resend";
import { newMessageEmail } from "@/lib/email/templates";
import { decodeHtmlEntities, isRichHtml } from "@/lib/rich-text-lite";
import { htmlToPlainText, sanitizeRichHtml } from "@/lib/rich-text";
import { attachmentIdsFrom, linkAttachments } from "@/lib/attachments";

/** Find or create a 1:1 conversation with another member, then open it. */
export async function startConversation(otherId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (otherId === user.id) redirect("/chat");

  // Talking to a mentor is part of the paid membership.
  const me = await getProfile();
  if (!me || !isSubscriber(me)) redirect("/join?locked=chat");

  // Normalize the pair so (a,b) is stable regardless of who initiates.
  const [a_id, b_id] = [user.id, otherId].sort();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("a_id", a_id)
    .eq("b_id", b_id)
    .maybeSingle();

  let convId = existing?.id;
  if (!convId) {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ a_id, b_id })
      .select("id")
      .single();
    convId = created?.id;
  }

  redirect(`/chat?c=${convId}`);
}

export async function sendMessage(conversationId: string, formData: FormData) {
  // The composer sends editor HTML; older clients (and tests) may still send
  // plain text. HTML passes the same sanitizing allowlist job descriptions
  // use, and every limit is measured on the words, not the markup.
  const raw = String(formData.get("body") ?? "").trim();
  // A TAGLESS editor body can still carry entities ("&nbsp;") — store it
  // decoded so the plain path never shows entity codes in a bubble.
  const body = isRichHtml(raw) ? sanitizeRichHtml(raw) : decodeHtmlEntities(raw);
  const plain = isRichHtml(raw) ? htmlToPlainText(body) : body;
  const attachIds = attachmentIdsFrom(formData);
  if ((!plain.trim() && attachIds.length === 0) || plain.length > 2000 || body.length > 10000) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Members write to each other. The gates are membership (free members read
  // their history but don't send) and that the other side is still here.
  const { data: conv } = await supabase
    .from("conversations")
    .select("a_id, b_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return;
  const otherId = conv.a_id === user.id ? conv.b_id : conv.a_id;
  const [{ data: me }, otherRes] = await Promise.all([
    supabase.from("profiles").select("role, status, first_name, full_name").eq("id", user.id).single(),
    supabase.from("profiles").select("role, status, digest_frequency").eq("id", otherId).single(),
  ]);
  // digest_frequency arrived in a later migration. If it isn't in the database
  // yet the whole select fails, the recipient reads as "not active" and members
  // stop being able to write to each other — a mail preference must never cost
  // us the chat. Fall back to the columns that were always there.
  const otherFallback = otherRes.error
    ? (await supabase.from("profiles").select("role, status").eq("id", otherId).single()).data
    : null;
  const other = otherRes.data ?? (otherFallback && { ...otherFallback, digest_frequency: "daily" });
  if (other?.status !== "active") return;
  // Free members read their history but don't send.
  if (!me || !(me.status === "active" || me.role === "admin")) return;

  // The RECIPIENT decides whether an email goes out — never anyone's role.
  // This used to be `sender is junior && recipient is an active mentor`, from
  // the days when a member could only write to a mentor. Members now message
  // each other freely, so that role pair matched almost nothing and most
  // messages notified nobody (BUG-002). What matters is that a message is
  // waiting for HER: any active member gets the heads-up, mentor or not.
  // The one voice that overrides us is her own — digest_frequency 'off' is
  // "בלי מיילים" in her profile, so we stay quiet. 'daily'/'unread' both want
  // to hear about waiting messages, and a missing value defaults to 'daily'
  // (so this still behaves if the digest-prefs migration hasn't run).
  const wantsEmail = (other.digest_frequency || "daily") !== "off";
  // Still only on the first new (unread) message from this sender in this
  // conversation, so a burst of messages doesn't become a burst of mail.
  let isFirstNew = false;
  if (wantsEmail) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("sender_id", user.id)
      .is("read_at", null);
    isFirstNew = (count ?? 0) === 0;
  }

  const { data: sent } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body,
    })
    .select("id")
    .single();
  if (sent) await linkAttachments(user.id, "message", sent.id, attachIds);
  // Service role: conversations has no RLS UPDATE policy, so the ordering
  // timestamp silently never moved. The sender was already validated above.
  await createAdminClient()
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (!wantsEmail || !isFirstNew) {
    // "she got no email" looks identical whether a gate closed or the send
    // failed. Name the closed gate so the logs answer it in one look.
    console.log("[chat email] skipped", { wantsEmail, isFirstNew });
  } else {
    try {
      const admin = createAdminClient();
      const { data: recipientUser } = await admin.auth.admin.getUserById(otherId);
      const email = recipientUser?.user?.email;
      if (email) {
        const fromName = me?.first_name || me?.full_name?.split(" ")[0] || "חברה";
        const built = newMessageEmail(fromName);
        const sent = await sendResendEmail({ to: email, subject: built.subject, html: built.html });
        // Surface failures in the server logs (RESEND_API_KEY missing, bounced
        // address, …) — otherwise "she never got an email" is invisible.
        if (!sent.ok) console.error("[chat email] send to recipient failed:", sent.error);
      } else {
        console.error("[chat email] recipient has no email address:", otherId);
      }
    } catch (e) {
      // Email is best-effort — never block sending the message.
      console.error("[chat email] failed:", e);
    }
  }

  revalidatePath("/chat");
}
