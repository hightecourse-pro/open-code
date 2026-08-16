"use client";

import { useRef, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { RichText } from "@/components/patterns/rich-text";
import { TextToolbar } from "@/components/patterns/text-toolbar";
import { editPost } from "@/app/(app)/feed/actions";
import { editMinutesLeft, withinEditWindow } from "@/lib/rich-text-lite";

/**
 * A post's words — and, for the ten minutes after she wrote them, a quiet way
 * to fix them. The window is checked again on the server; here it only decides
 * whether the pencil is worth showing.
 */
export function PostBody({
  postId,
  body,
  createdAt,
  canEdit,
}: {
  postId: string;
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

  const open = canEdit && withinEditWindow(createdAt);
  const left = editMinutesLeft(createdAt);

  if (!editing) {
    return (
      <div className="group/body relative">
        <RichText body={shown} className="text-[15px] leading-relaxed text-ink-900" />
        {open && (
          <button
            type="button"
            onClick={() => {
              setText(shown);
              setEditing(true);
            }}
            className="mt-1 inline-flex items-center gap-1 text-[12px] text-ink-400 hover:text-brand-purple transition-colors"
          >
            <Pencil size={12} /> עריכה
            <span className="text-ink-300">· עוד {left} דק׳</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          const res = await editPost(postId, fd);
          if (res?.error) {
            setError(res.error);
            return;
          }
          setShown(text);
          setEditing(false);
          setError(null);
        })
      }
      className="flex flex-col gap-1.5"
    >
      <textarea
        ref={ref}
        name="body"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(10, Math.max(3, text.split("\n").length + 1))}
        className="w-full text-[15px] text-ink-900 border border-ink-300 rounded-lg p-2.5 outline-none focus:border-brand-purple resize-y"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <TextToolbar targetRef={ref} />
        <button
          type="submit"
          disabled={pending}
          className="ms-auto text-[13px] font-semibold text-white bg-brand-gradient rounded-md px-4 py-1.5 disabled:opacity-60"
        >
          {pending ? "שומר…" : "שמירה"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="text-[13px] text-ink-500 hover:text-danger inline-flex items-center gap-1"
        >
          <X size={13} /> ביטול
        </button>
      </div>
      {error && <div className="text-[12.5px] text-danger">{error}</div>}
    </form>
  );
}
