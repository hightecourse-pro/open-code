"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { Send } from "lucide-react";
import { Alert, Button, Textarea } from "@/components/ui";
import { replyToCoordinator, type CoordChatState } from "./actions";

/** The team's reply box — the answer is signed with the sender's name. */
export function CoordinatorReplyForm({
  contactId,
  signature,
}: {
  contactId: string;
  signature: string;
}) {
  const [state, action, pending] = useActionState<CoordChatState, FormData>(
    replyToCoordinator.bind(null, contactId),
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 border-t border-ink-100 pt-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      <Textarea name="body" rows={3} required maxLength={4000} placeholder="התשובה שלך לרכזת…" />
      <div className="flex items-center gap-2.5">
        <Button type="submit" size="sm" disabled={pending}>
          <Send size={14} /> {pending ? "שולחת…" : "שליחת תשובה"}
        </Button>
        <span className="text-[11.5px] text-ink-400">תישלח בחתימת: צוות קוד פתוח · {signature}</span>
      </div>
    </form>
  );
}
