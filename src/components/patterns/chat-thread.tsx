"use client";

import { useEffect, useOptimistic, useRef, useState, type ReactNode } from "react";
import { RichText } from "@/components/patterns/rich-text";
import { ChatComposer } from "@/components/patterns/chat-composer";
import { cn, timeAgo } from "@/lib/utils";

export interface ThreadMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

/** A message on screen — either from the server, or hers still on its way. */
type Bubble = ThreadMessage & { pending?: boolean };

/** How many of my messages with exactly this text the server already returned. */
function countMine(messages: ThreadMessage[], meId: string, body: string): number {
  return messages.filter((m) => m.sender_id === meId && m.body === body).length;
}

/** The grace the server gets to hand the thread back with her message in it. */
const DELIVERY_GRACE_MS = 2000;

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
  action,
  hint,
  footer,
}: {
  messages: ThreadMessage[];
  meId: string;
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
  const [sending, setSending] = useState<{ body: string; seen: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inFlight = bubbles.some((b) => b.pending);
  // Delivered = the revalidated thread came back holding it. Read from the
  // messages we were just handed, never remembered — a remembered "sent" is
  // exactly the lie this component must not tell.
  const awaiting = !!sending && countMine(messages, meId, sending.body) <= sending.seen;

  useEffect(() => {
    // The optimistic bubble is already gone; give the revalidated thread a
    // beat to arrive before telling her something went wrong.
    if (!sending || !awaiting || inFlight) return;
    const timer = setTimeout(() => {
      setSending(null);
      setFailed(true);
      if (inputRef.current) {
        inputRef.current.value = sending.body;
        inputRef.current.focus();
      }
    }, DELIVERY_GRACE_MS);
    return () => clearTimeout(timer);
  }, [sending, awaiting, inFlight]);

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

      <div className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto bg-ink-50/40">
        {bubbles.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div
              key={m.id}
              className={cn(
                "flex flex-col max-w-[78%]",
                mine ? "self-end items-end" : "self-start items-start",
                m.pending && "opacity-60"
              )}
            >
              <div
                className={cn(
                  "px-3.5 py-2 text-sm leading-relaxed break-words",
                  mine
                    ? "bg-brand-gradient text-white rounded-2xl rounded-br-md [&_a]:text-white [&_a]:underline [&_code]:bg-white/25 [&_b]:text-white"
                    : "bg-white border border-ink-200 text-ink-900 rounded-2xl rounded-bl-md"
                )}
              >
                <RichText body={m.body} />
              </div>
              <span className="text-[10.5px] text-ink-400 mt-0.5 px-1" suppressHydrationWarning>
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
            inputRef={inputRef}
            action={async (formData) => {
              const body = String(formData.get("body") ?? "").trim();
              if (!body) return;
              setFailed(false);
              setSending({ body, seen: countMine(messages, meId, body) });
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
