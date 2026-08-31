"use client";

import { useEffect, useOptimistic, useRef, useState, type ReactNode } from "react";
import { MessageBody } from "@/components/patterns/rich-text";
import { AttachmentList } from "@/components/patterns/attachment-list";
import type { AttachmentView } from "@/lib/attachments";
import type { RichEditorHandle } from "@/components/patterns/rich-text-editor";
import { ChatComposer } from "@/components/patterns/chat-composer";
import { cn, timeAgo } from "@/lib/utils";

export interface ThreadMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  attachments?: AttachmentView[];
  /** One emoji per participant, keyed by profile id. */
  reactions?: Record<string, string> | null;
  /** The quoted message's id (chat reply), when there is one. */
  reply_to_id?: string | null;
  /** Set when the sender edited the message. */
  edited_at?: string | null;
}

/** How long a sent message stays editable — mirrors the server's window. */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** The reaction palette — must match the server action's allowlist. */
const REACTION_EMOJIS = ["💜", "👍", "😂", "🎉", "🙏", "😮"];

/** A message on screen — either from the server, or hers still on its way. */
type Bubble = ThreadMessage & { pending?: boolean };

/**
 * The words of a body, markup and whitespace flattened. Delivery detection
 * compares WORDS, not raw strings — the server may sanitize or normalize the
 * markup it stores, and a message that came back transformed is still the
 * same delivered message. Raw equality here once branded a stored message
 * "לא נשלחה" and handed it back to the member who had just sent it.
 */
function plainKey(body: string): string {
  return body
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** How many of my messages with these words the server already returned. */
function countMine(messages: ThreadMessage[], meId: string, key: string): number {
  return messages.filter((m) => m.sender_id === meId && plainKey(m.body) === key).length;
}

/**
 * The grace the server gets to hand the thread back with her message in it.
 * Generous on purpose: a cold serverless start plus a continent round trip
 * can exceed a tight window, and a false "לא נשלחה" is worse than a slow
 * confirmation.
 */
const DELIVERY_GRACE_MS = 6000;

/**
 * The message list and the box under it. Her own message appears the moment
 * she hits send — the send itself is a long server round-trip, and staring at
 * an empty box is what makes it feel broken.
 *
 * It never fakes a delivery: the bubble stays marked "נשלחת…" until the
 * message comes back from the server, and if it never does, her words go back
 * into the box with an honest failure line.
 */
export function ChatThread({
  messages,
  meId,
  otherName,
  action,
  hint,
  footer,
  reactAction,
  editAction,
}: {
  messages: ThreadMessage[];
  meId: string;
  /** Her display name — feeds the avatar chip beside her bubbles. */
  otherName?: string;
  /** Missing when she can't write in this thread — `footer` says why.
   *  A returned verdict ({ok}) is trusted outright; a void return falls back
   *  to watching the revalidated thread (the old delivery detection). */
  action?: (formData: FormData) => void | Promise<void | { ok: boolean }>;
  /** One line above the box framing what this conversation is for. */
  hint?: ReactNode;
  /** Rendered instead of the box when there is no action. */
  footer?: ReactNode;
  /** Toggles the caller's emoji on a message — absent on read-only threads. */
  reactAction?: (messageId: string, emoji: string) => Promise<void>;
  /** Rewrites the caller's own message — absent on read-only threads. */
  editAction?: (messageId: string, formData: FormData) => Promise<void>;
}) {
  const [bubbles, addBubble] = useOptimistic<Bubble[], string>(messages, (state, body) => [
    ...state,
    {
      id: `pending-${state.length}`,
      sender_id: meId,
      body,
      created_at: new Date().toISOString(),
      pending: true,
    },
  ]);
  // sendMessage hands nothing back, so the only honest proof a message went out
  // is it returning inside the revalidated thread.
  const [sending, setSending] = useState<{ body: string; key: string; seen: number } | null>(null);
  const [failed, setFailed] = useState(false);
  // Quote-reply state: what the next send will quote (shown above the box).
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string; name: string } | null>(null);
  // Edit state: which of HER messages the box is rewriting right now.
  const [editing, setEditing] = useState<{ id: string; original: string } | null>(null);
  // Which message's emoji palette is open, and optimistic reaction overlays.
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [localReactions, setLocalReactions] = useState<Record<string, Record<string, string>>>({});
  const byId = new Map(bubbles.map((b) => [b.id, b]));
  /** The quoted snippet a bubble shows — flattened words, capped. */
  const quotePreview = (id: string): { preview: string; name: string } | null => {
    const q = byId.get(id);
    if (!q) return { preview: "הודעה קודמת", name: "" };
    return {
      preview: plainKey(q.body).slice(0, 90) || "קובץ מצורף",
      name: q.sender_id === meId ? "את" : otherName ?? "היא",
    };
  };
  const reactionsOf = (m: Bubble): Record<string, string> =>
    localReactions[m.id] ?? ((m.reactions ?? {}) as Record<string, string>);
  const toggleLocal = (m: Bubble, emoji: string) => {
    const cur = { ...reactionsOf(m) };
    if (cur[meId] === emoji) delete cur[meId];
    else cur[meId] = emoji;
    setLocalReactions((s) => ({ ...s, [m.id]: cur }));
    setPickerFor(null);
    void reactAction?.(m.id, emoji);
  };
  const composerRef = useRef<RichEditorHandle | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // The freshest thread the server handed us — the failure timer consults THIS
  // at fire time instead of trusting a closure from seconds ago.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  // Whether she is reading the latest message or scrolled up into history.
  // Starts true so a freshly opened thread lands on the newest message.
  const atBottomRef = useRef(true);
  const inFlight = bubbles.some((b) => b.pending);
  // Delivered = the revalidated thread came back holding it. Read from the
  // messages we were just handed, never remembered — a remembered "sent" is
  // exactly the lie this component must not tell.
  const awaiting = !!sending && countMine(messages, meId, sending.key) <= sending.seen;

  useEffect(() => {
    // The optimistic bubble is already gone; give the revalidated thread a
    // beat to arrive before telling her something went wrong.
    if (!sending || !awaiting || inFlight) return;
    const timer = setTimeout(() => {
      // Last look before crying wolf: if the freshest thread holds the
      // message, it was delivered — a race between the revalidated props and
      // this timer must never turn a sent message into a failure banner.
      const delivered = countMine(messagesRef.current, meId, sending.key) > sending.seen;
      setSending(null);
      if (delivered) return;
      setFailed(true);
      composerRef.current?.setHtml(sending.body);
      composerRef.current?.focus();
    }, DELIVERY_GRACE_MS);
    return () => clearTimeout(timer);
  }, [sending, awaiting, inFlight, meId]);

  // Follow the conversation down — on first open and whenever a message
  // arrives while she is at the bottom. If she scrolled up to reread
  // something, we stay exactly where she is; nothing yanks her back down.
  const bubbleCount = bubbles.length;
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [bubbleCount]);

  const last = bubbles[bubbles.length - 1];
  const iWrote = bubbles.some((b) => b.sender_id === meId);
  // A locked thread (no send action) never INVITES writing — that reads as a
  // contradiction next to the lock explanation below.
  const status = !last
    ? action
      ? "עוד לא התחלתן — כתבי לה מה מעסיק אותך 💜"
      : "אין עדיין הודעות בשיחה הזו"
    : inFlight || awaiting
      ? "שולח…"
      : last.sender_id === meId
        ? "נשלח · ממתינה לתשובה שלה"
        : `${iWrote ? "היא ענתה לך" : "היא כתבה לך"} · ${timeAgo(last.created_at)}`;

  return (
    <>
      <div
        className="px-3.5 py-2 border-b border-ink-100 text-[12.5px] text-ink-500 truncate"
        suppressHydrationWarning
      >
        {status}
      </div>

      <div
        ref={listRef}
        onScroll={() => {
          const el = listRef.current;
          if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="flex-1 min-h-0 p-4 flex flex-col gap-1 overflow-y-auto bg-ink-50/40"
      >
        {bubbles.map((m, i) => {
          const mine = m.sender_id === meId;
          // Every run of messages is HEADED by its sender's name, both sides
          // (the owner, 30/8: "לא ברור מי כתב מה... כותרת ברורה לכל צד").
          const runStart = bubbles[i - 1]?.sender_id !== m.sender_id;
          return (
            <div
              key={m.id}
              className={cn(
                "flex flex-col max-w-[70%]",
                mine ? "self-end items-end" : "self-start items-start",
                m.pending && "opacity-60"
              )}
            >
              {runStart && (
                <span
                  className={cn(
                    "text-[11px] font-bold mt-1.5 mb-0.5 px-1",
                    mine ? "text-brand-pink-deep" : "text-brand-purple ms-[30px]"
                  )}
                >
                  {mine ? "את" : otherName ?? "הצד השני"}
                </span>
              )}
              <div className={cn("group flex items-end gap-1.5", !mine && "flex-row-reverse")}>
                {runStart && !mine ? (
                  <span
                    aria-hidden
                    className="w-6 h-6 rounded-full bg-tint-purple text-brand-purple text-[11px] font-bold flex items-center justify-center shrink-0 mb-0.5"
                  >
                    {(otherName ?? "").slice(0, 1) || "·"}
                  </span>
                ) : (
                  !mine && <span className="w-6 shrink-0" aria-hidden />
                )}
                <div
                  className={cn(
                    "px-3.5 py-2 text-sm leading-relaxed break-words",
                    mine
                      ? "bg-brand-gradient text-white rounded-2xl rounded-br-md"
                      : "bg-white border border-ink-200 text-ink-900 rounded-2xl rounded-bl-md"
                  )}
                >
                  {m.reply_to_id &&
                    (() => {
                      const q = quotePreview(m.reply_to_id);
                      return q ? (
                        <div
                          className={cn(
                            "border-s-2 ps-2 mb-1.5 text-[12px] leading-snug rounded-sm",
                            mine ? "border-white/60 text-white/85" : "border-brand-purple text-ink-500"
                          )}
                        >
                          {q.name && <b>{q.name}: </b>}
                          {q.preview}
                        </div>
                      ) : null;
                    })()}
                  <MessageBody body={m.body} invert={mine} />
                  {m.attachments && <AttachmentList items={m.attachments} compact />}
                </div>
                {/* Reply + react — appear on hover (always reachable on touch
                    via the reaction chips row below). */}
                {!m.pending && (action || reactAction) && (
                  <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity mb-1">
                    {reactAction && (
                      <button
                        type="button"
                        aria-label="הוספת תגובה"
                        onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                        className="w-6 h-6 rounded-full text-[13px] text-ink-400 hover:bg-ink-100 cursor-pointer"
                      >
                        🙂
                      </button>
                    )}
                    {editAction && mine && Date.now() - new Date(m.created_at).getTime() < EDIT_WINDOW_MS && (
                      <button
                        type="button"
                        aria-label="עריכת ההודעה"
                        onClick={() => {
                          setEditing({ id: m.id, original: m.body });
                          setReplyTo(null);
                          composerRef.current?.setHtml(m.body);
                          composerRef.current?.focus();
                        }}
                        className="w-6 h-6 rounded-full text-[12px] text-ink-400 hover:bg-ink-100 cursor-pointer"
                      >
                        ✏️
                      </button>
                    )}
                    {action && (
                      <button
                        type="button"
                        aria-label="ציטוט"
                        onClick={() => {
                          const q = quotePreview(m.id);
                          setReplyTo({ id: m.id, preview: q?.preview ?? "", name: q?.name ?? "" });
                          composerRef.current?.focus();
                        }}
                        className="w-6 h-6 rounded-full text-[12px] text-ink-400 hover:bg-ink-100 cursor-pointer"
                      >
                        ↩
                      </button>
                    )}
                  </span>
                )}
              </div>
              {pickerFor === m.id && reactAction && (
                <div
                  className={cn(
                    "flex gap-1 bg-white border border-ink-200 rounded-full px-2 py-1 shadow-md mt-1 z-10",
                    !mine && "ms-[30px]"
                  )}
                >
                  {REACTION_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => toggleLocal(m, e)}
                      className={cn(
                        "text-[16px] leading-none p-1 rounded-full hover:bg-ink-100 cursor-pointer",
                        reactionsOf(m)[meId] === e && "bg-tint-purple"
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
              {Object.keys(reactionsOf(m)).length > 0 && (
                <div className={cn("flex gap-1 -mt-1.5 z-[5]", !mine && "ms-[30px]")}>
                  {Object.entries(
                    Object.values(reactionsOf(m)).reduce<Record<string, number>>((acc, e) => {
                      acc[e] = (acc[e] ?? 0) + 1;
                      return acc;
                    }, {})
                  ).map(([emoji, n]) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => reactAction && toggleLocal(m, emoji)}
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[12px] leading-none bg-white border rounded-full px-1.5 py-0.5 shadow-sm",
                        reactionsOf(m)[meId] === emoji ? "border-brand-purple" : "border-ink-200",
                        reactAction && "cursor-pointer hover:border-brand-purple"
                      )}
                    >
                      {emoji}
                      {n > 1 && <span className="text-ink-500">{n}</span>}
                    </button>
                  ))}
                </div>
              )}
              <span
                className={cn("text-[10.5px] text-ink-400 mt-0.5 px-1", !mine && "me-[30px]")}
                suppressHydrationWarning
              >
                {m.pending ? "נשלחת…" : timeAgo(m.created_at)}
                {m.edited_at && !m.pending && " · נערכה"}
              </span>
            </div>
          );
        })}
        {bubbles.length === 0 && (
          <p className="text-sm text-ink-500 text-center my-auto">
            {action ? "התחילי את השיחה — כתבי לה הודעה ראשונה 💜" : "אין עדיין הודעות בשיחה הזו 💜"}
          </p>
        )}
      </div>

      {failed && (
        <div role="alert" className="px-3.5 py-2 border-t border-ink-100 text-[12.5px] text-[#A8254B] bg-danger-bg">
          ההודעה לא נשלחה — החזרנו לך אותה לתיבה, אפשר לנסות שוב 💜
        </div>
      )}

      {action ? (
        <>
          {hint && (
            <div className="px-3.5 pt-2.5 text-[12.5px] text-ink-500 leading-relaxed">{hint}</div>
          )}
          {editing && (
            <div className="mx-3.5 mt-2 flex items-start gap-2 border-s-2 border-brand-pink-deep bg-tint-pink/40 rounded-md px-3 py-1.5 text-[12.5px] text-ink-700">
              <span className="flex-1 min-w-0 truncate">✏️ עריכת הודעה — שליחה תעדכן את ההודעה המקורית</span>
              <button
                type="button"
                aria-label="ביטול העריכה"
                onClick={() => {
                  setEditing(null);
                  composerRef.current?.setHtml("");
                }}
                className="text-ink-400 hover:text-ink-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
          {replyTo && !editing && (
            <div className="mx-3.5 mt-2 flex items-start gap-2 border-s-2 border-brand-purple bg-tint-purple/50 rounded-md px-3 py-1.5 text-[12.5px] text-ink-700">
              <span className="flex-1 min-w-0 truncate">
                {replyTo.name && <b>{replyTo.name}: </b>}
                {replyTo.preview}
              </span>
              <button
                type="button"
                aria-label="ביטול הציטוט"
                onClick={() => setReplyTo(null)}
                className="text-ink-400 hover:text-ink-700 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
          <ChatComposer
            editorRef={composerRef}
            action={async (formData) => {
              const body = String(formData.get("body") ?? "").trim();
              if (!body) return;
              setFailed(false);
              if (editing) {
                // Rewriting, not sending: no optimistic bubble, no delivery
                // watch — the revalidated thread brings the new text back.
                const target = editing.id;
                setEditing(null);
                await editAction?.(target, formData);
                return;
              }
              if (replyTo) {
                formData.set("reply_to", replyTo.id);
                setReplyTo(null);
              }
              const key = plainKey(body);
              setSending({ body, key, seen: countMine(messages, meId, key) });
              addBubble(body);
              try {
                const verdict = await action(formData);
                if (verdict && typeof verdict === "object" && "ok" in verdict) {
                  // The server answered outright — no more inferring delivery
                  // from a revalidation racing a timer (the owner, 31/8: a slow
                  // cold start branded DELIVERED messages "לא נשלחה").
                  setSending(null);
                  if (!verdict.ok) {
                    setFailed(true);
                    composerRef.current?.setHtml(body);
                    composerRef.current?.focus();
                  }
                }
              } catch {
                // The action itself failed to reach the server — that IS a
                // real failure: hand her words back.
                setSending(null);
                setFailed(true);
                composerRef.current?.setHtml(body);
                composerRef.current?.focus();
              }
            }}
          />
        </>
      ) : (
        footer
      )}
    </>
  );
}
