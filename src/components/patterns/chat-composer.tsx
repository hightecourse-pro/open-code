"use client";

import { useRef, type RefObject } from "react";
import { Button } from "@/components/ui";
import { RichTextEditor, type RichEditorHandle } from "@/components/patterns/rich-text-editor";

/**
 * The chat message box — the same rich editor the rest of the product uses,
 * chat-sized: what she makes bold IS bold as she types, Enter sends,
 * Shift+Enter opens a new line.
 *
 * `editorRef` lets the thread reach the box: when a send fails it puts her
 * words back where she wrote them instead of losing them.
 */
export function ChatComposer({
  action,
  editorRef,
}: {
  action: (formData: FormData) => void | Promise<void>;
  editorRef?: RefObject<RichEditorHandle | null>;
}) {
  const localRef = useRef<RichEditorHandle | null>(null);
  const ref = editorRef ?? localRef;
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      // Awaited, not fired and forgotten: the surrounding transition has to
      // stay pending for the whole send, or the optimistic bubble in the
      // thread would vanish the instant it appeared.
      action={async (fd) => {
        if (ref.current?.isEmpty()) return;
        const sending = action(fd);
        ref.current?.clear();
        await sending;
      }}
      className="flex flex-col gap-1.5 p-3 border-t border-ink-100"
    >
      <div className="flex gap-2 items-end">
        <RichTextEditor
          name="body"
          compact
          submitOnEnter
          placeholder="כתבי הודעה…"
          tools={["bold", "italic", "strike", "link"]}
          editorRef={ref}
        />
        <Button type="submit" size="sm" className="mb-9">
          שליחה
        </Button>
      </div>
    </form>
  );
}
