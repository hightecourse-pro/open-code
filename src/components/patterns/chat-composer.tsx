"use client";

import { useRef } from "react";
import { Button } from "@/components/ui";
import { TextToolbar } from "@/components/patterns/text-toolbar";

/**
 * The chat message box. Enter sends, Shift+Enter opens a new line — the
 * behaviour every messaging app has trained people to expect — and the
 * toolbar writes the same formatting markers the forum uses.
 */
export function ChatComposer({ action }: { action: (formData: FormData) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        action(fd);
        if (ref.current) ref.current.value = "";
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
