"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { Send } from "lucide-react";
import { Alert, Button, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { sendCoordinatorMessage, type ChatState } from "../../actions";
import type { CoordinatorMessage } from "@/lib/coordinator-data";

const TIME_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/** The message list + composer. Team replies carry the answering name. */
export function CoordinatorChatThread({ messages }: { messages: CoordinatorMessage[] }) {
  const [state, action, pending] = useActionState<ChatState, FormData>(sendCoordinatorMessage, {});
  const endRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pe-1">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[85%] rounded-[14px] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap",
              m.sender === "coordinator"
                ? "self-end bg-tint-purple text-ink-900 rounded-ee-[4px]"
                : "self-start bg-ink-50 border border-ink-100 text-ink-900 rounded-es-[4px]"
            )}
          >
            {m.sender === "team" && (
              <div className="text-[11px] font-bold text-brand-purple mb-0.5">
                צוות קוד פתוח{m.team_author_name ? ` · ${m.team_author_name}` : ""}
              </div>
            )}
            {m.body}
            <div className="text-[10.5px] text-ink-400 mt-1 text-start" dir="ltr">
              {TIME_HE.format(new Date(m.created_at))}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-ink-500 text-sm py-4 text-center">
            עוד אין הודעות — ההודעה הראשונה שלך תפתח את השיחה 💜
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form ref={formRef} action={action} className="flex flex-col gap-2 border-t border-ink-100 pt-3">
        {state.error && <Alert variant="danger">{state.error}</Alert>}
        <Textarea
          name="body"
          rows={3}
          required
          maxLength={4000}
          placeholder="כתבי לנו כל דבר — נשמח לשמוע 💜"
        />
        <Button type="submit" disabled={pending} className="w-fit">
          <Send size={14} /> {pending ? "שולחת…" : "שליחה"}
        </Button>
      </form>
    </div>
  );
}
