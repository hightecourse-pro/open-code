"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui";
import { RichTextEditor, type RichEditorHandle } from "@/components/patterns/rich-text-editor";
import { AttachmentPicker } from "@/components/patterns/attachment-picker";

/**
 * The chat message box - the same rich editor the rest of the product uses,
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
  const [attachEpoch, setAttachEpoch] = useState(0);

  // Straight back to typing after every send (tester feedback). The editor is
  // NEVER remounted: the chips reset through the picker's resetEpoch, so
  // whatever she types while the send is still in flight stays put (the old
  // key-remount wiped her first letters a second later - 22/10).
  useEffect(() => {
    if (attachEpoch > 0) ref.current?.focus();
  }, [attachEpoch, ref]);

  return (
    <form
      ref={formRef}
      // Awaited, not fired and forgotten: the surrounding transition has to
      // stay pending for the whole send, or the optimistic bubble in the
      // thread would vanish the instant it appeared.
      action={async (fd) => {
        if (ref.current?.isEmpty() && !fd.get("attach_ids")) return;
        const sending = action(fd);
        ref.current?.clear();
        ref.current?.focus();
        setAttachEpoch((n) => n + 1);
        await sending;
      }}
      className="flex flex-col gap-1.5 p-3 border-t border-ink-100"
    >
      <AttachmentPicker resetEpoch={attachEpoch}>
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
      </AttachmentPicker>
    </form>
  );
}
