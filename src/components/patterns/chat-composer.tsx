"use client";

import { useRef, type RefObject } from "react";
import { Button } from "@/components/ui";
import { TextToolbar } from "@/components/patterns/text-toolbar";

/**
 * The chat message box. Enter sends, Shift+Enter opens a new line — the
 * behaviour every messaging app has trained people to expect — and the
 * toolbar writes the same formatting markers the forum uses.
 *
 * `inputRef` lets the thread reach the box: when a send fails it puts her
 * words back where she wrote them instead of losing them.
 */
export function ChatComposer({
  action,
  inputRef,
}: {
  action: (formData: FormData) => void | Promise<void>;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? localRef;
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      // Awaited, not fired and forgotten: the surrounding transition has to
      // stay pending for the whole send, or the optimistic bubble in the
      // thread would vanish the instant it appeared.
      action={async (fd) => {
        const sending = action(fd);
        if (ref.current) ref.current.value = "";
        await sending;
      }}
      className="flex flex-col gap-1.5 p-3 border-t border-ink-100"
    >
      <div className="flex gap-2 items-end">
        <textarea
          ref={ref}
          name="body"
          rows={1}
          required
          autoComplete="off"
          placeholder="כתבי הודעה…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          className="flex-1 px-3.5 py-2.5 rounded-md border border-ink-300 text-sm outline-none focus:border-brand-purple resize-none max-h-32"
        />
        <Button type="submit" size="sm">
          שליחה
        </Button>
      </div>
      <TextToolbar targetRef={ref} />
    </form>
  );
}
