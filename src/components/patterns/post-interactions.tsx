"use client";

import { useState, useTransition } from "react";
import { Heart, MessageCircle, Bookmark, Flag, Send } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { toggleReaction, addComment, reportContent } from "@/app/(app)/feed/actions";

export interface PostComment {
  id: string;
  body: string;
  author_name: string;
  author_initials: string | null;
  created_at: string;
}

export interface PostInteractionsProps {
  postId: string;
  likeCount: number;
  liked: boolean;
  saved: boolean;
  comments: PostComment[];
}

export function PostInteractions({ postId, likeCount, liked, saved, comments }: PostInteractionsProps) {
  const [like, setLike] = useState({ on: liked, count: likeCount });
  const [isSaved, setIsSaved] = useState(saved);
  const [openComments, setOpenComments] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [, start] = useTransition();

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
          onClick={onLike}
          className={cn(
            "flex items-center gap-1.5 text-[13.5px] px-2 py-1 rounded-lg transition-colors",
            like.on ? "text-brand-pink-deep" : "text-ink-500 hover:bg-ink-100 hover:text-brand-pink-deep"
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
          onClick={onSave}
          className={cn(
            "flex items-center gap-1.5 text-[13.5px] px-2 py-1 rounded-lg transition-colors",
            isSaved ? "text-brand-purple" : "text-ink-500 hover:bg-ink-100 hover:text-brand-purple"
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
            placeholder="מה הבעיה בפוסט? (אופציונלי)"
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
                  {c.author_name} <span className="text-ink-400 font-normal">· {timeAgo(c.created_at)}</span>
                </div>
                <div className="text-[13.5px] text-ink-800 whitespace-pre-wrap">{c.body}</div>
              </div>
            </div>
          ))}

          <form action={addComment.bind(null, postId)} className="flex gap-2 items-end">
            <textarea
              name="body"
              rows={1}
              required
              placeholder="הוסיפי תגובה…"
              className="flex-1 text-[13.5px] border border-ink-300 rounded-md px-3 py-2 outline-none focus:border-brand-purple resize-none"
            />
            <button
              type="submit"
              aria-label="שליחת תגובה"
              className="bg-brand-gradient text-white rounded-md p-2.5 shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
