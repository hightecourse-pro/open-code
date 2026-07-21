import { Avatar, Badge } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { PostInteractions, type PostComment } from "@/components/patterns/post-interactions";
import type { PostIntent, UserRole } from "@/types/database";

export interface FeedPost {
  id: string;
  body: string;
  intent: PostIntent;
  tech_tags: string[];
  is_official: boolean;
  is_pinned: boolean;
  created_at: string;
  author: {
    full_name: string;
    avatar_initials: string | null;
    role: UserRole;
    specialization: string | null;
  } | null;
  likeCount?: number;
  liked?: boolean;
  saved?: boolean;
  comments?: PostComment[];
}

const INTENT_LABEL: Record<PostIntent, string> = {
  consult: "התייעצות",
  knowledge: "שיתוף ידע",
  success: "הצלחה 🎉",
};

export function PostCard({ post, canWrite = true }: { post: FeedPost; canWrite?: boolean }) {
  const author = post.author;
  const isMentor = author?.role === "mentor";
  const isStaff = author?.role === "admin";
  const tone = isMentor ? "gold" : "pink";

  return (
    <article className="bg-white border border-ink-200 rounded-[18px] p-[18px] px-5 transition-shadow duration-[220ms] hover:shadow-md">
      <header className="flex gap-3 mb-3 items-start">
        <Avatar
          initials={author?.avatar_initials || author?.full_name?.slice(0, 1) || "ק"}
          tone={tone}
          crown={isMentor}
        />
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-[15px] text-ink-1000 flex items-center gap-1.5 flex-wrap">
            {author?.full_name || "חברת קהילה"}
            {isMentor && <Badge variant="mentor">👑 מנטורית</Badge>}
            {isStaff && (
              <span className="bg-ink-1000 text-white px-2 py-px rounded-full text-[10.5px] font-bold">
                צוות
              </span>
            )}
          </div>
          <div className="text-[12.5px] text-ink-500">
            {[INTENT_LABEL[post.intent], author?.specialization, timeAgo(post.created_at)]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </header>

      <p className="text-[15px] leading-relaxed text-ink-900 whitespace-pre-wrap break-words">{post.body}</p>

      {post.tech_tags.length > 0 && (
        <div className="flex gap-1.5 mt-2.5 flex-wrap">
          {post.tech_tags.map((tag) => (
            <Badge key={tag} variant="tech">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <PostInteractions
        postId={post.id}
        likeCount={post.likeCount ?? 0}
        liked={post.liked ?? false}
        saved={post.saved ?? false}
        comments={post.comments ?? []}
        canWrite={canWrite}
      />
    </article>
  );
}
