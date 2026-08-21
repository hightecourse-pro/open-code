import Link from "next/link";
import { isRichHtml } from "@/lib/rich-text-lite";
import { htmlToPlainText } from "@/lib/rich-text";
import { MessageCircle, Heart, Pin } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";
import { INTENT_LABEL } from "@/components/patterns/post-card";
import type { PostIntent, UserRole } from "@/types/database";

/**
 * One row in the forum topic list — the Discourse convention: the list shows
 * WHO opened WHAT and how alive the thread is; the replies themselves live one
 * click deeper, on the topic page.
 */
export interface ForumTopic {
  id: string;
  title: string;
  intent: PostIntent;
  tech_tags: string[];
  is_official: boolean;
  is_pinned: boolean;
  created_at: string;
  /** Newest activity in the thread — the last reply, or the post itself. */
  last_activity_at: string;
  author: {
    full_name: string;
    avatar_initials: string | null;
    role: UserRole;
    specialization: string | null;
  } | null;
  replyCount: number;
  likeCount: number;
}

/** A topic's list title — the first line of the post's words, kept short. */
export function topicTitle(body: string, max = 90): string {
  // Rich-editor posts store HTML; the title wants only the words.
  const words = isRichHtml(body) ? htmlToPlainText(body) : body;
  const first = words.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  return first.length > max ? `${first.slice(0, max - 1)}…` : first || "נושא בפורום";
}

export function ForumTopicRow({ topic }: { topic: ForumTopic }) {
  const author = topic.author;
  const isMentor = author?.role === "mentor";
  const isStaff = author?.role === "admin";

  return (
    <Link
      href={`/forum/${topic.id}`}
      className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-ink-50 transition-colors group"
    >
      <Avatar
        initials={author?.avatar_initials || author?.full_name?.slice(0, 1) || "ק"}
        tone={isMentor ? "gold" : "pink"}
        crown={isMentor}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {topic.is_pinned && <Pin size={13} className="text-brand-pink-deep shrink-0" />}
          <span className="font-display font-bold text-[15px] text-ink-1000 group-hover:text-brand-purple transition-colors truncate">
            {topic.title}
          </span>
          {isStaff && (
            <span className="bg-ink-1000 text-white px-2 py-px rounded-full text-[10px] font-bold shrink-0">
              צוות
            </span>
          )}
        </div>
        <div className="text-[12.5px] text-ink-500 mt-0.5 truncate">
          {[
            author?.full_name || "חברת קהילה",
            INTENT_LABEL[topic.intent],
            ...topic.tech_tags.slice(0, 3),
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>

      {/* activity column — replies are the headline number, Discourse-style */}
      <div className="flex items-center gap-3 shrink-0">
        {topic.likeCount > 0 && (
          <span className="hidden sm:flex items-center gap-1 text-[12.5px] text-ink-400">
            <Heart size={13} /> {topic.likeCount}
          </span>
        )}
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold",
            topic.replyCount > 0
              ? "bg-tint-purple text-brand-purple"
              : "bg-ink-100 text-ink-400"
          )}
          title={topic.replyCount === 1 ? "תגובה אחת" : `${topic.replyCount} תגובות`}
        >
          <MessageCircle size={14} />
          {topic.replyCount}
        </span>
        <span className="hidden md:block w-16 text-end text-[12px] text-ink-400">
          {timeAgo(topic.last_activity_at)}
        </span>
      </div>
    </Link>
  );
}
