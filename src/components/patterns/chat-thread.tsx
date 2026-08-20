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
}

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
}: {
  messages: ThreadMessage[];
  meId: string;
  /** Her display name — feeds the avatar chip beside her bubbles. */
  otherName?: string;
  /** Missing when she can't write in this thread — `footer` says why. */
  action?: (formData: FormData) => void | Promise<void>;
  /** One line above the box framing what this conversation is for. */
  hint?: ReactNode;
  /** Rendered instead of the box when there is no action. */
  footer?: ReactNode;
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
  const status = !last
    ? "עוד לא התחלתן — כתבי לה מה מעסיק אותך 💜"
    : inFlight || awaiting
      ? "שולחת…"
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
          // Her avatar chip marks the start of each of her runs — so even a
          // fast back-and-forth reads unambiguously: my side, her side.
          const runStart = !mine && bubbles[i - 1]?.sender_id !== m.sender_id;
          return (
            <div
              key={m.id}
              className={cn(
                "flex flex-col max-w-[70%]",
                mine ? "self-end items-end" : "self-start items-start",
                m.pending && "opacity-60"
              )}
            >
              <div className={cn("flex items-end gap-1.5", !mine && "flex-row-reverse")}>
                {runStart ? (
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
                  <MessageBody body={m.body} invert={mine} />
                  {m.attachments && <AttachmentList items={m.attachments} compact />}
                </div>
              </div>
              <span
                className={cn("text-[10.5px] text-ink-400 mt-0.5 px-1", !mine && "me-[30px]")}
                suppressHydrationWarning
              >
                {m.pending ? "נשלחת…" : timeAgo(m.created_at)}
              </span>
            </div>
          );
        })}
        {bubbles.length === 0 && (
          <p className="text-sm text-ink-500 text-center my-auto">
            התחילי את השיחה — כתבי לה הודעה ראשונה 💜
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
          <ChatComposer
            editorRef={composerRef}
            action={async (formData) => {
              const body = String(formData.get("body") ?? "").trim();
              if (!body) return;
              setFailed(false);
              const key = plainKey(body);
              setSending({ body, key, seen: countMine(messages, meId, key) });
              addBubble(body);
              await action(formData);
            }}
          />
        </>
      ) : (
        footer
      )}
    </>
  );
}
