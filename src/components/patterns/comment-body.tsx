"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { RichText } from "@/components/patterns/rich-text";
import { TextToolbar } from "@/components/patterns/text-toolbar";
import { editComment } from "@/app/(app)/feed/actions";
import { editMinutesLeft, withinEditWindow } from "@/lib/rich-text-lite";

/** A comment's words, with the same ten-minute grace a post gets. */
export function CommentBody({
  commentId,
  body,
  createdAt,
  canEdit,
}: {
  commentId: string;
  body: string;
  createdAt: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(body);
  const [shown, setShown] = useState(body);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  if (!editing) {
    return (
      <>
        <RichText body={shown} className="text-[13.5px] text-ink-800" />
        {canEdit && withinEditWindow(createdAt) && (
          <button
            type="button"
            onClick={() => {
              setText(shown);
              setEditing(true);
            }}
            className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-ink-400 hover:text-brand-purple transition-colors"
          >
            <Pencil size={11} /> עריכה
            <span className="text-ink-300">· עוד {editMinutesLeft(createdAt)} דק׳</span>
          </button>
        )}
      </>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await editComment(commentId, fd);
          if (res?.error) {
            setError(res.error);
            return;
          }
          setShown(text);
          setEditing(false);
          setError(null);
        })
      }
      className="flex flex-col gap-1.5 mt-1"
    >
      <textarea
        ref={ref}
        name="body"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(8, Math.max(2, text.split("\n").length + 1))}
        className="w-full text-[13.5px] text-ink-900 border border-ink-300 rounded-md p-2 outline-none focus:border-brand-purple resize-y bg-white"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <TextToolbar targetRef={ref} />
        <button
          type="submit"
          disabled={pending}
          className="ms-auto text-[12.5px] font-semibold text-white bg-brand-gradient rounded-md px-3 py-1 disabled:opacity-60"
        >
          {pending ? "שומר…" : "שמירה"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="text-[12.5px] text-ink-500 hover:text-danger"
        >
          ביטול
        </button>
      </div>
      {error && <div className="text-[12px] text-danger">{error}</div>}
    </form>
  );
}
