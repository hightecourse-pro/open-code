"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, isSubscriber } from "@/lib/auth";
import { decodeHtmlEntities, isRichHtml } from "@/lib/rich-text-lite";
import { htmlToPlainText, sanitizeRichHtml } from "@/lib/rich-text";
import { attachmentIdsFrom, linkAttachments } from "@/lib/attachments";

/** The reaction palette — WhatsApp-style, one emoji per person per message. */
const REACTION_EMOJIS = new Set(["💜", "👍", "😂", "🎉", "🙏", "😮"]);

/**
 * Toggle the caller's emoji reaction on a message (the owner, 1/9). Her own
 * client can only SELECT messages of conversations she is in — that read is
 * the participation check; the write itself runs with the service role
 * because members have no UPDATE policy on messages (by design).
 */
export async function toggleReaction(messageId: string, emoji: string): Promise<void> {
  if (!REACTION_EMOJIS.has(emoji)) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data: msg } = await supabase
    .from("messages")
    .select("id, reactions")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg) return;
  const current = { ...((msg.reactions ?? {}) as Record<string, string>) };
  if (current[user.id] === emoji) delete current[user.id];
  else current[user.id] = emoji;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient()
    .from("messages")
    .update({ reactions: current as never })
    .eq("id", messageId);
}

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

  // A failed insert (RLS, race) must not produce /chat?c=undefined — land on
  // the list instead of an error page.
  if (!convId) redirect("/chat");

  redirect(`/chat?c=${convId}`);
}

/**
 * Returns an explicit verdict: {ok:true} means the row is in the database.
 * The client once inferred delivery only from the revalidated thread coming
 * back in time — on a cold serverless start that raced a 6s timer and branded
 * DELIVERED messages "לא נשלחה" (the owner, 31/8). The verdict ends the guess.
 */
export async function sendMessage(
  conversationId: string,
  formData: FormData
): Promise<{ ok: boolean }> {
  // The composer sends editor HTML; older clients (and tests) may still send
  // plain text. HTML passes the same sanitizing allowlist job descriptions
  // use, and every limit is measured on the words, not the markup.
  const raw = String(formData.get("body") ?? "").trim();
  // A TAGLESS editor body can still carry entities ("&nbsp;") — store it
  // decoded so the plain path never shows entity codes in a bubble.
  const body = isRichHtml(raw) ? sanitizeRichHtml(raw) : decodeHtmlEntities(raw);
  const plain = isRichHtml(raw) ? htmlToPlainText(body) : body;
  const attachIds = attachmentIdsFrom(formData);
  if ((!plain.trim() && attachIds.length === 0) || plain.length > 2000 || body.length > 10000)
    return { ok: false };

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
  if (!conv) return { ok: false };
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
  if (other?.status !== "active" && other?.status !== "pending") return { ok: false };
  // Free members read their history but don't send — EXCEPT to the team:
  // answering the team's personal note must never be behind a paywall.
  if (!me) return { ok: false };
  const writingToTeam = other?.role === "admin";
  if (!(me.status === "active" || me.role === "admin" || (writingToTeam && me.status === "pending")))
    return { ok: false };
  // Who may be WRITTEN to (the owner, 1/9): the team writes to anyone still
  // here; a member writes only to מנויות (real payers — pending included),
  // approved mentors, and the team. The directory view is the single source
  // of that truth (masked role + is_subscriber).
  if (me.role !== "admin") {
    const { data: dir } = await supabase
      .from("members_directory")
      .select("role, is_subscriber")
      .eq("id", otherId)
      .maybeSingle();
    if (!dir || !(dir.role === "admin" || dir.role === "mentor" || dir.is_subscriber))
      return { ok: false };
  }

  // Quoting (the owner, 1/9): a reply carries the quoted message's id — only
  // if that message really lives in THIS conversation (her client can only
  // read it if she's a participant, so the select is the check).
  let replyToId: string | null = null;
  const replyTo = String(formData.get("reply_to") ?? "").trim();
  if (replyTo) {
    const { data: quoted } = await supabase
      .from("messages")
      .select("id, conversation_id")
      .eq("id", replyTo)
      .maybeSingle();
    if (quoted?.conversation_id === conversationId) replyToId = quoted.id;
  }

  const { data: sent } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body,
      reply_to_id: replyToId,
    })
    .select("id")
    .single();
  if (!sent) return { ok: false };
  await linkAttachments(user.id, "message", sent.id, attachIds);
  // Service role: conversations has no RLS UPDATE policy, so the ordering
  // timestamp silently never moved. The sender was already validated above.
  await createAdminClient()
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  // NO immediate email (the owner, 1/9): the "מישהי כתבה לך" mail goes out
  // from the 10-minute cron ONLY for messages that are ≥5 minutes old, still
  // unread, and unanswered — an answered-in-time chat never emails at all.
  // (See drainChatEmailGrace in the session-reminders cron route.)

  revalidatePath("/chat");
  return { ok: true };
}

/** How long a sent message stays editable — WhatsApp's convention. */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Rewrite the caller's OWN message (the owner, 1/9: "אפשרות לערוך בצ'אט") —
 * within 15 minutes of sending. Same sanitation as sendMessage; edited_at
 * marks the bubble. Members have no UPDATE policy on messages, so the write
 * runs with the service role after the sender+window checks.
 */
export async function editMessage(messageId: string, formData: FormData): Promise<void> {
  const raw = String(formData.get("body") ?? "").trim();
  const body = isRichHtml(raw) ? sanitizeRichHtml(raw) : decodeHtmlEntities(raw);
  const plain = isRichHtml(raw) ? htmlToPlainText(body) : body;
  if (!plain.trim() || plain.length > 2000 || body.length > 10000) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Her client can only read messages of her own conversations — and only
  // her OWN message may change.
  const { data: msg } = await supabase
    .from("messages")
    .select("id, sender_id, created_at")
    .eq("id", messageId)
    .maybeSingle();
  if (!msg || msg.sender_id !== user.id) return;
  if (Date.now() - new Date(msg.created_at).getTime() > EDIT_WINDOW_MS) return;

  await createAdminClient()
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  revalidatePath("/chat");
}

export interface ChatMemberHit {
  id: string;
  full_name: string;
  specialization: string | null;
  avatar_initials: string | null;
}

/**
 * The new-chat picker's search — a bounded server lookup instead of shipping
 * the whole community directory into the client (it grows with every member).
 */
export async function searchChatMembers(q: string): Promise<ChatMemberHit[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const needle = q.trim().slice(0, 60);
  // The directory view is the searchable population (hidden/paused/rejected
  // never appear). A regular member gets only who she may WRITE to — מנויות,
  // approved mentors and the team; an admin reaches everyone listed.
  const { data: meRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  let query = supabase
    .from("members_directory")
    .select("id, full_name, specialization, avatar_initials, role, is_subscriber")
    .neq("id", user.id)
    .order("full_name", { ascending: true })
    .limit(24);
  if (needle) {
    query = query.or(`full_name.ilike.%${needle}%,specialization.ilike.%${needle}%`);
  }
  const { data } = await query;
  const rows =
    meRow?.role === "admin"
      ? (data ?? [])
      : (data ?? []).filter((m) => m.role === "admin" || m.role === "mentor" || m.is_subscriber);
  return rows.slice(0, 8).map(({ id, full_name, specialization, avatar_initials }) => ({
    id, full_name, specialization, avatar_initials,
  }));
}
