"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Bookmark, Flag, Send, Lock } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { CommentBody } from "@/components/patterns/comment-body";
import { RichTextEditor, type RichEditorHandle } from "@/components/patterns/rich-text-editor";
import { AttachmentPicker } from "@/components/patterns/attachment-picker";
import { AttachmentList } from "@/components/patterns/attachment-list";
import type { AttachmentView } from "@/lib/attachments";
import { toggleReaction, addComment, reportContent } from "@/app/(app)/feed/actions";

export interface PostComment {
  attachments?: AttachmentView[];
  id: string;
  body: string;
  author_name: string;
  author_initials: string | null;
  created_at: string;
  edited_at?: string | null;
  /** True when the signed-in member wrote it — she may fix it for 10 minutes. */
  mine?: boolean;
}

export interface PostInteractionsProps {
  postId: string;
  likeCount: number;
  liked: boolean;
  saved: boolean;
  comments: PostComment[];
  /** Free members read the thread but don't take part in it. */
  canWrite?: boolean;
  /** The topic page opens the replies; the list keeps them behind a click. */
  defaultOpenComments?: boolean;
}

export function PostInteractions({
  postId,
  likeCount,
  liked,
  saved,
  comments,
  canWrite = true,
  defaultOpenComments = false,
}: PostInteractionsProps) {
  const [like, setLike] = useState({ on: liked, count: likeCount });
  const [isSaved, setIsSaved] = useState(saved);
  const [openComments, setOpenComments] = useState(defaultOpenComments);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [, start] = useTransition();
  const replyRef = useRef<RichEditorHandle | null>(null);
  const [replyEpoch, setReplyEpoch] = useState(0);

  function onLike() {
    setLike((s) => ({ on: !s.on, count: s.count + (s.on ? -1 : 1) }));
    start(() => void toggleReaction(postId, "like"));
  }
  function onSave() {
    setIsSaved((s) => !s);
    start(() => void toggleReaction(postId, "save"));
  }

  return (
    <div className="mt-3 pt-3 border-t border-ink-100">
      <div className="flex gap-4 items-center">
        <button
          type="button"
          onClick={canWrite ? onLike : undefined}
          disabled={!canWrite}
          className={cn(
            "flex items-center gap-1.5 text-[13.5px] px-2 py-1 rounded-lg transition-colors",
            like.on ? "text-brand-pink-deep" : "text-ink-500",
            canWrite ? "hover:bg-ink-100 hover:text-brand-pink-deep" : "cursor-default"
          )}
        >
          <Heart size={16} fill={like.on ? "currentColor" : "none"} />
          אהבתי{like.count > 0 ? ` · ${like.count}` : ""}
        </button>

        <button
          type="button"
          onClick={() => setOpenComments((o) => !o)}
          className="flex items-center gap-1.5 text-[13.5px] text-ink-500 px-2 py-1 rounded-lg hover:bg-ink-100 hover:text-brand-purple transition-colors"
        >
          <MessageCircle size={16} />
          תגובה{comments.length > 0 ? ` · ${comments.length}` : ""}
        </button>

        <button
          type="button"
          onClick={canWrite ? onSave : undefined}
          disabled={!canWrite}
          className={cn(
            "flex items-center gap-1.5 text-[13.5px] px-2 py-1 rounded-lg transition-colors",
            isSaved ? "text-brand-purple" : "text-ink-500",
            canWrite ? "hover:bg-ink-100 hover:text-brand-purple" : "cursor-default"
          )}
        >
          <Bookmark size={16} fill={isSaved ? "currentColor" : "none"} />
          {isSaved ? "נשמר" : "שמירה"}
        </button>

        <button
          type="button"
          onClick={() => setReporting((r) => !r)}
          className="ms-auto flex items-center gap-1.5 text-[12.5px] text-ink-400 px-2 py-1 rounded-lg hover:text-danger transition-colors"
        >
          <Flag size={14} /> דיווח
        </button>
      </div>

      {reporting && !reported && (
        <form
          action={(fd) => {
            start(() => void reportContent("post", postId, String(fd.get("reason") ?? "")));
            setReported(true);
            setReporting(false);
          }}
          className="flex gap-2 mt-2"
        >
          <input
            name="reason"
            placeholder="מה הבעיה בפוסט? (לא חובה)"
            className="flex-1 text-[13px] border border-ink-300 rounded-md px-2.5 py-1.5 outline-none focus:border-danger"
          />
          <button type="submit" className="text-[13px] font-semibold text-danger px-3">
            שליחת דיווח
          </button>
        </form>
      )}
      {reported && <div className="mt-2 text-[12.5px] text-ink-500">הדיווח נשלח לצוות — תודה שאכפת לך 💜</div>}

      {openComments && (
        <div className="mt-3 flex flex-col gap-3">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Avatar size="xs" tone="pink" initials={c.author_initials || c.author_name.slice(0, 1) || "ק"} />
              <div className="flex-1 min-w-0 bg-ink-50 rounded-lg px-3 py-2">
                <div className="text-[12.5px] font-semibold text-ink-900">
                  {c.author_name}{" "}
                  <span className="text-ink-400 font-normal">
                    · {timeAgo(c.created_at)}
                    {c.edited_at ? " · נערך" : ""}
                  </span>
                </div>
                <CommentBody
                  commentId={c.id}
                  body={c.body}
                  createdAt={c.created_at}
                  canEdit={c.mine === true}
                />
                {c.attachments && <AttachmentList items={c.attachments} compact />}
              </div>
            </div>
          ))}

          {canWrite ? (
            <form
              action={async (fd) => {
                if (replyRef.current?.isEmpty() && !fd.get("attach_ids")) return;
                await addComment(postId, fd);
                replyRef.current?.clear();
                setReplyEpoch((n) => n + 1);
              }}
              className="flex flex-col gap-1.5"
            >
              <AttachmentPicker key={replyEpoch}>
              <div className="flex gap-2 items-end">
                <RichTextEditor
                  name="body"
                  compact
                  submitOnEnter
                  placeholder="הוסיפי תגובה…"
                  tools={["bold", "italic", "strike", "link"]}
                  editorRef={replyRef}
                />
                <button
                  type="submit"
                  aria-label="שליחת תגובה"
                  className="bg-brand-gradient text-white rounded-md p-2.5 shrink-0 mb-9"
                >
                  <Send size={16} />
                </button>
              </div>
              </AttachmentPicker>
            </form>
          ) : (
            <Link
              href="/join"
              className="flex items-center gap-2 text-[13px] text-ink-700 bg-tint-purple border border-[#DDC9EC] rounded-md px-3 py-2 hover:border-brand-purple transition-colors"
            >
              <Lock size={14} className="text-brand-purple shrink-0" />
              <span className="flex-1">כתיבת תגובות נפתחת עם מנוי — נשמח שתצטרפי לשיחה 💜</span>
              <span className="font-semibold text-brand-purple">לשדרוג ←</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
