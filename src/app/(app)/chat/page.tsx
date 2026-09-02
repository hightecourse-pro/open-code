import type { Metadata } from "next";
import Link from "next/link";
import { attachmentsFor } from "@/lib/attachments";
import { decodeHtmlEntities, isRichHtml } from "@/lib/rich-text-lite";
import { htmlToPlainText } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSubscriber, requireProfile } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { ChatSearch } from "@/components/patterns/chat-search";
import { ChatThread } from "@/components/patterns/chat-thread";
import { NewChatButton } from "@/components/patterns/new-chat-button";
import { cn, timeAgo } from "@/lib/utils";
import type { UserRole } from "@/types/database";
import { AutoRefresh } from "@/components/patterns/auto-refresh";
import { editMessage, sendMessage, startConversation, toggleReaction } from "./actions";

export const metadata: Metadata = { title: "צ'אטים" };

/** How we name the woman on the other side, under her name in the header. */
function roleWord(role: UserRole): string {
  if (role === "mentor") return "מנטורית בקהילה";
  if (role === "admin") return "מהצוות שלנו";
  return "חברת קהילה";
}

/** One line of the last thing said in a thread — words only, shortened. */
function previewText(body: string, mine: boolean): string {
  // New messages are editor HTML; the preview wants only the words. Tagless
  // bodies can still carry entities (&nbsp;) — decode those too.
  const words = isRichHtml(body) ? htmlToPlainText(body) : decodeHtmlEntities(body);
  const flat = words.replace(/\s+/g, " ").trim();
  return `${mine ? "את: " : ""}${flat || "📎 קובץ מצורף"}`;
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; with?: string }>;
}) {
  const me = await requireProfile();
  const { c: activeId, with: withId } = await searchParams;
  // ?with={profileId}: a deep link that opens (or starts) the 1:1 with that
  // member — lets other screens link INTO a conversation with a plain <a>
  // (e.g. "שאלה על המשרה?" on the apply page, opened in a new tab so her
  // half-filled form survives). startConversation redirects to ?c=….
  if (withId && /^[0-9a-f-]{36}$/.test(withId) && withId !== me.id) {
    await startConversation(withId);
  }
  const supabase = await createClient();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, a_id, b_id, last_message_at, created_at")
    .order("last_message_at", { ascending: false });

  const active = (conversations ?? []).find((c) => c.id === activeId) ?? null;
  const otherIds = [...new Set((conversations ?? []).map((c) => (c.a_id === me.id ? c.b_id : c.a_id)))];
  const conversationIds = (conversations ?? []).map((c) => c.id);

  // Everything that only needs the conversation list runs as ONE parallel
  // wave — this used to be 5 sequential round trips before first paint.
  //
  // The mark-read UPDATE rides in the same wave instead of blocking it:
  // opening the thread reads it, via the service role because RLS doesn't let
  // a recipient update a sender's rows — safe here since `active` came from
  // the member's own conversation list. read_at drives both the mentor
  // "first new message" email and the digest's unread count, so without it
  // both fire forever. Because the unread query below runs concurrently with
  // it, the thread she just opened may keep its unread dot for this one
  // render — the next refresh clears it, a fair trade for not serializing a
  // write before every paint.
  const [
    { data: others },
    { data: assignments },
    { data: newestMessages },
    ,
    { data: recentMessages },
    { data: unreadRows },
  ] = await Promise.all([
    // Resolve the "other" participant for each conversation.
    otherIds.length
      ? supabase
          .from("profiles")
          .select("id, full_name, avatar_initials, role, status, specialization")
          .in("id", otherIds)
      : Promise.resolve({ data: [] }),
    // Which of these women is the mentor an admin actually matched her with —
    // otherwise her mentor looks like any other thread in the list. kind='general'
    // only: an employment accompaniment is a placement companion, not the mentor
    // this crown and the interview hint below are talking about.
    supabase
      .from("mentor_requests")
      .select("assigned_mentor_id")
      .eq("profile_id", me.id)
      .eq("kind", "general")
      .not("assigned_mentor_id", "is", null),
    // The newest 200 only — a years-long thread must not decide how long the
    // page blocks. Fetched newest-first so the LIMIT keeps the right end,
    // reversed back to chronological below.
    active
      ? supabase
          .from("messages")
          .select("id, sender_id, body, created_at, reactions, reply_to_id, edited_at")
          .eq("conversation_id", active.id)
          .order("created_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
    active
      ? createAdminClient()
          .from("messages")
          .update({ read_at: new Date().toISOString() })
          .eq("conversation_id", active.id)
          .neq("sender_id", me.id)
          .is("read_at", null)
      : Promise.resolve(null),
    // The list needs to say what happened, not just when: a preview per
    // thread and which ones are still waiting for her. One window over the
    // newest messages instead of a query per row — an older thread simply
    // shows no preview.
    conversationIds.length
      ? supabase
          .from("messages")
          .select("conversation_id, sender_id, body, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(150)
      : Promise.resolve({ data: [] }),
    conversationIds.length
      ? supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", conversationIds)
          .neq("sender_id", me.id)
          .is("read_at", null)
      : Promise.resolve({ data: [] }),
  ]);

  const otherMap = new Map((others ?? []).map((o) => [o.id, o]));
  // An unapproved mentor carries no mentor indication (the owner, 1/9) — she
  // reads as a regular member everywhere until the team approves her.
  for (const o of otherMap.values()) {
    if (o.role === "mentor" && o.status !== "active") o.role = "junior";
  }
  const myMentorIds = new Set(
    (assignments ?? []).map((a) => a.assigned_mentor_id).filter((id): id is string => !!id)
  );
  const activeOther = active ? otherMap.get(active.a_id === me.id ? active.b_id : active.a_id) : null;

  // Who may be WRITTEN to (the owner, 1/9): the team writes to anyone still
  // here; a member writes only to מנויות (real payers — pending included),
  // approved mentors and the team. The directory view carries that truth.
  const subscriber = isSubscriber(me);
  const activeOtherId = activeOther?.id ?? null;
  let otherWritable = false;
  if (activeOtherId) {
    if (me.role === "admin") {
      otherWritable = activeOther!.status === "active" || activeOther!.status === "pending";
    } else {
      const { data: dir } = await supabase
        .from("members_directory")
        .select("role, is_subscriber")
        .eq("id", activeOtherId)
        .maybeSingle();
      otherWritable = !!dir && (dir.role === "admin" || dir.role === "mentor" || dir.is_subscriber);
    }
  }
  // True when the thread is locked because SHE isn't a subscriber — the one
  // case that gets a clear explanation (the owner: "הודעה ברורה").
  const otherNotSubscribed =
    !!activeOther &&
    !otherWritable &&
    me.role !== "admin" &&
    (activeOther.status === "active" || activeOther.status === "pending");
  // Writing to the TEAM is never behind a paywall — a member must be able to
  // answer the team's personal note even before she subscribes.
  const canSend = (subscriber || activeOther?.role === "admin") && otherWritable;

  // Chronological again for display (fetched newest-first for the LIMIT).
  const messages = [...(newestMessages ?? [])].reverse();

  const lastMessage = new Map<string, { body: string; mine: boolean }>();
  for (const m of recentMessages ?? []) {
    // Newest first — the first row we meet for a conversation is its last word.
    if (!lastMessage.has(m.conversation_id)) {
      lastMessage.set(m.conversation_id, { body: m.body, mine: m.sender_id === me.id });
    }
  }
  const unreadCount = new Map<string, number>();
  for (const m of unreadRows ?? []) {
    unreadCount.set(m.conversation_id, (unreadCount.get(m.conversation_id) ?? 0) + 1);
  }

  // A conversation nobody wrote in yet is clutter, not a chat (the owner,
  // 31/8: "למה יש צ'אטים שהם ריקים?") — the row is created the moment a
  // member picks someone, so an abandoned pick leaves an empty thread behind.
  // Hide those from the list. "Has traffic" without querying every message:
  // a preview in the recent window, an unread message, or last_message_at
  // that moved away from created_at (sendMessage bumps it). The one she just
  // opened stays visible so she can write the first message.
  const listedConversations = (conversations ?? []).filter((c) => {
    if (c.id === activeId) return true;
    if (lastMessage.has(c.id)) return true;
    if ((unreadCount.get(c.id) ?? 0) > 0) return true;
    return (
      new Date(c.last_message_at).getTime() - new Date(c.created_at).getTime() > 1500
    );
  });

  const activeIsMyMentor = !!activeOther && myMentorIds.has(activeOther.id);
  const activeSubtitle = activeOther
    ? [roleWord(activeOther.role), activeOther.specialization].filter(Boolean).join(" · ")
    : "";

  // Files hanging on the visible messages — signed URLs minted here, so the
  // client never holds a permanent address.
  const messageAtt = await attachmentsFor("message", (messages ?? []).map((m) => m.id));
  const messagesWithFiles = (messages ?? []).map((m) => ({
    ...m,
    reactions: (m as { reactions?: Record<string, string> | null }).reactions ?? null,
    reply_to_id: (m as { reply_to_id?: string | null }).reply_to_id ?? null,
    edited_at: (m as { edited_at?: string | null }).edited_at ?? null,
    attachments: messageAtt.get(m.id),
  }));

  return (
    <div className="flex flex-col gap-5">
      {/* A conversation, not a page: her side is optimistic already; the other
          side arrives on its own now. Also clears the unread badge shortly
          after a thread is opened (the refresh re-renders the layout count). */}
      <AutoRefresh seconds={15} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-[28px] font-black text-ink-1000">צ&apos;אטים</h1>
        {subscriber && <NewChatButton />}
      </div>

      {/* A free member with no conversations used to see a bare empty page —
          the upgrade offer must exist here like everywhere gated (the owner,
          2026-08-30: "הצעה לשדרוג בכל מקום בו אין הרשאה"). */}
      {!subscriber && (
        <Link
          href="/join"
          className="flex items-center gap-2.5 bg-tint-purple border border-[#DDC9EC] rounded-md p-3.5 px-4 text-[13.5px] text-ink-700 hover:border-brand-purple transition-colors"
        >
          <span className="flex-1">
            {me.role === "mentor"
              ? "ההתכתבות תיפתח ברגע שהצוות יאשר את הבקשה שלך כמנטורית — בלי תשלום 💜"
              : "ההתכתבות עם חברות ומנטוריות נפתחת עם מנוי — ההיסטוריה שלך נשמרת ומחכה לך 💜"}
          </span>
          <span className="font-semibold text-brand-purple whitespace-nowrap">
            {me.role === "mentor" ? "למצב הבקשה ←" : "לשדרוג ←"}
          </span>
        </Link>
      )}

      {/* Bounded to the viewport so the thread scrolls inside its own pane and
          the composer stays on screen — the page itself never scrolls to chat.
          On mobile the panes stack: the list keeps its natural height (capped),
          the thread takes whatever is left. The constants are the measured
          space above the grid (page padding + title) plus the bottom padding;
          a free member also has the join banner overhead, taller where it
          wraps on a narrow screen. */}
      <div
        className={cn(
          "grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:grid-cols-[260px_1fr] gap-4 min-h-[420px]",
          subscriber
            ? "h-[calc(100dvh-120px)]"
            : "h-[calc(100dvh-228px)] md:h-[calc(100dvh-186px)]"
        )}
      >
        {/* conversation list */}
        <div className="bg-white border border-ink-200 rounded-[18px] p-2 shadow-sm min-h-0 max-h-[35dvh] md:max-h-none overflow-y-auto">
          {listedConversations.length > 3 && (
            <ChatSearch
              items={listedConversations.map((c) => ({
                id: c.id,
                name: otherMap.get(c.a_id === me.id ? c.b_id : c.a_id)?.full_name ?? "חברה",
              }))}
            />
          )}
          {listedConversations.length > 0 ? (
            listedConversations.map((c) => {
              const other = otherMap.get(c.a_id === me.id ? c.b_id : c.a_id);
              const preview = lastMessage.get(c.id);
              const unread = unreadCount.get(c.id) ?? 0;
              return (
                <Link
                  key={c.id}
                  href={`/chat?c=${c.id}`}
                  className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-md transition-colors border",
                    c.id === activeId
                      ? "bg-tint-pink border-brand-pink"
                      : "border-transparent hover:bg-ink-100"
                  )}
                >
                  <Avatar
                    size="sm"
                    tone={other?.role === "mentor" ? "gold" : "pink"}
                    crown={other?.role === "mentor"}
                    initials={other?.avatar_initials || other?.full_name?.slice(0, 1) || "ק"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-sm text-ink-900 truncate">
                        {other?.full_name ?? "חברה"}
                      </span>
                      {other && myMentorIds.has(other.id) && <span className="text-[10px]">👑</span>}
                      <span className="ms-auto text-[10.5px] text-ink-400 shrink-0">
                        {timeAgo(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-[11.5px] truncate flex-1",
                          unread > 0 ? "text-ink-900 font-medium" : "text-ink-500"
                        )}
                      >
                        {/* Outside the 150-message window we simply don't know
                            what was said last — the timestamp above already
                            tells the truth, and claiming nothing was written
                            would be a lie about a full thread. */}
                        {preview ? previewText(preview.body, preview.mine) : " "}
                      </span>
                      {unread > 0 && (
                        <span
                          aria-label={unread === 1 ? "הודעה אחת שלא נקראה" : `${unread} הודעות שלא נקראו`}
                          className="w-2 h-2 rounded-full bg-brand-pink-deep shrink-0"
                        />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="text-sm text-ink-500 p-4 text-center leading-relaxed">
              אין עדיין שיחות — אפשר להתחיל אחת מ
              <Link href="/mentor" className="font-semibold text-brand-purple hover:underline">
                עמוד המנטוריות
              </Link>{" "}
              או מ
              <Link href="/members" className="font-semibold text-brand-purple hover:underline">
                המשתתפות שלנו
              </Link>{" "}
              💬
            </p>
          )}
        </div>

        {/* thread */}
        <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm flex flex-col min-h-0 overflow-hidden">
          {active && activeOther ? (
            <>
              <div className="flex items-center gap-2.5 p-3.5 border-b border-ink-100">
                <Avatar
                  size="sm"
                  tone={activeOther.role === "mentor" ? "gold" : "pink"}
                  crown={activeOther.role === "mentor"}
                  initials={activeOther.avatar_initials || activeOther.full_name.slice(0, 1)}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-bold text-ink-1000">{activeOther.full_name}</span>
                    {activeIsMyMentor ? (
                      <span className="text-[10.5px] font-bold bg-tint-warm text-[#8C5E0E] px-2 py-0.5 rounded-full">
                        👑 המנטורית שלך
                      </span>
                    ) : (
                      activeOther.role === "mentor" && (
                        <span className="text-[10.5px] font-bold bg-tint-warm text-[#8C5E0E] px-2 py-0.5 rounded-full">
                          👑 מנטורית
                        </span>
                      )
                    )}
                  </div>
                  <div className="text-[12.5px] text-ink-500 truncate">{activeSubtitle}</div>
                </div>
              </div>

              <ChatThread
                messages={messagesWithFiles}
                reactAction={canSend ? toggleReaction : undefined}
                editAction={canSend ? editMessage : undefined}
                meId={me.id}
                otherName={activeOther?.full_name ?? undefined}
                action={canSend ? sendMessage.bind(null, active.id) : undefined}
                hint={
                  activeIsMyMentor
                    ? "כאן אפשר לשאול על ראיונות, על החודשים הראשונים בעבודה או פשוט להתייעץ 💜"
                    : undefined
                }
                footer={
                  !subscriber ? (
                    <Link
                      href="/join"
                      className="p-3.5 border-t border-ink-100 text-[13px] text-ink-700 text-center bg-tint-purple hover:text-brand-purple transition-colors"
                    >
                      {me.role === "mentor"
                        ? "ההתכתבות תיפתח עם אישור הבקשה שלך כמנטורית 💜"
                        : "ההתכתבות נפתחת עם מנוי — ההיסטוריה שלך נשמרת ומחכה לך 💜"}
                    </Link>
                  ) : otherNotSubscribed ? (
                    // A clear reason (the owner, 1/9): chat is a subscriber
                    // benefit, so a thread with a member who isn't a מנויה
                    // waits until she joins.
                    <div className="p-3.5 border-t border-ink-100 text-[13px] text-ink-500 text-center bg-ink-50">
                      התכתבות אפשרית רק עם מנויות הקהילה — היא עדיין לא מנויה, וברגע שתצטרף השיחה
                      תיפתח 💜
                    </div>
                  ) : (
                    // Deliberately vague for anyone who LEFT (paused/rejected):
                    // why she can't write here is nobody else's business.
                    <div className="p-3.5 border-t border-ink-100 text-[13px] text-ink-500 text-center bg-ink-50">
                      אי אפשר לשלוח הודעות חדשות בשיחה הזו כרגע — היא נשמרת כאן במלואה 💜
                    </div>
                  )
                }
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-ink-500 text-sm">
              בחרי שיחה כדי להתחיל
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
