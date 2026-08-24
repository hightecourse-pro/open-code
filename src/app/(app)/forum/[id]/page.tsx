import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { attachmentsFor } from "@/lib/attachments";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser, isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { AutoRefresh } from "@/components/patterns/auto-refresh";
import { PostCard, type FeedPost } from "@/components/patterns/post-card";
import { topicTitle } from "@/components/patterns/forum-topic-row";
import type { PostComment } from "@/components/patterns/post-interactions";
import type { UserRole } from "@/types/database";

// Always fresh — a new reply shows without a manual refresh.
export const dynamic = "force-dynamic";

type ProfileLite = {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  role: UserRole;
  specialization: string | null;
};

// cache()d because generateMetadata and the page body both ask for the same
// topic — one fetch per request instead of two.
const loadPost = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, body, intent, tech_tags, is_official, is_pinned, created_at, edited_at, author_id")
    .eq("id", id)
    .eq("kind", "forum")
    .maybeSingle();
  return data;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await loadPost(id);
  return { title: post ? topicTitle(post.body, 60) : "פורום" };
}

export default async function ForumTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getUser();
  const profile = await requireCommunityAccess();
  const canWrite = isSubscriber(profile);

  const post = await loadPost(id);
  if (!post) notFound();

  const [{ data: reactions }, { data: comments }, { data: railRows }] = await Promise.all([
    supabase.from("reactions").select("post_id, profile_id, kind").eq("post_id", post.id),
    supabase
      .from("comments")
      .select("id, post_id, body, author_id, created_at, edited_at")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true }),
    // The PM's side layout: while she reads one conversation, the rest of the
    // forum stays one click away in a rail beside it (wide screens only).
    supabase
      .from("posts")
      .select("id, body, is_pinned, created_at")
      .eq("kind", "forum")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const authorIds = [...new Set([post.author_id, ...(comments ?? []).map((c) => c.author_id)])];
  const { data: authorRows } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_initials, role, specialization")
    .in("id", authorIds);
  const authorMap = new Map(((authorRows ?? []) as ProfileLite[]).map((a) => [a.id, a]));

  const [postAtt, commentAtt] = await Promise.all([
    attachmentsFor("post", [post.id]),
    attachmentsFor("comment", (comments ?? []).map((c) => c.id)),
  ]);

  const topicComments: PostComment[] = (comments ?? []).map((c) => {
    const a = authorMap.get(c.author_id);
    return {
      attachments: commentAtt.get(c.id),
      id: c.id,
      body: c.body,
      author_name: a?.full_name ?? "חברת קהילה",
      author_initials: a?.avatar_initials ?? null,
      created_at: c.created_at,
      edited_at: c.edited_at,
      mine: !!user && c.author_id === user.id,
    };
  });

  const rx = reactions ?? [];
  const feedPost: FeedPost = {
    id: post.id,
    body: post.body,
    intent: post.intent,
    tech_tags: post.tech_tags,
    is_official: post.is_official,
    is_pinned: post.is_pinned,
    created_at: post.created_at,
    edited_at: post.edited_at,
    mine: !!user && post.author_id === user.id,
    author: authorMap.get(post.author_id) ?? null,
    likeCount: rx.filter((r) => r.kind === "like").length,
    liked: !!user && rx.some((r) => r.kind === "like" && r.profile_id === user.id),
    saved: !!user && rx.some((r) => r.kind === "save" && r.profile_id === user.id),
    comments: topicComments,
    attachments: postAtt.get(post.id),
  };

  const rail = (railRows ?? []).map((t) => ({
    id: t.id,
    title: topicTitle(t.body, 60),
    pinned: t.is_pinned,
  }));

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/forum"
        className="flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-purple hover:underline w-fit"
      >
        <ArrowRight size={15} />
        חזרה לכל הנושאים
      </Link>

      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
        {/* The topic rail — the rest of the forum beside the conversation. */}
        <aside className="hidden xl:block sticky top-4 bg-white border border-ink-200 rounded-[16px] shadow-sm overflow-hidden">
          <div className="px-3.5 py-2.5 text-[11.5px] font-bold text-ink-400 uppercase tracking-wide bg-ink-50/60 border-b border-ink-100">
            עוד בפורום
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-ink-100">
            {rail.map((t) => (
              <Link
                key={t.id}
                href={`/forum/${t.id}`}
                aria-current={t.id === post.id ? "page" : undefined}
                className={
                  "block px-3.5 py-2.5 text-[12.5px] leading-snug transition-colors " +
                  (t.id === post.id
                    ? "bg-tint-purple text-brand-purple font-bold"
                    : "text-ink-700 hover:bg-ink-50")
                }
              >
                {t.pinned && <span className="me-1">📌</span>}
                {t.title}
              </Link>
            ))}
          </div>
        </aside>

        <PostCard post={feedPost} canWrite={canWrite} defaultOpenComments />
      </div>
      {/* A conversation, not a page: replies from other members show up on
          their own. Faster than the topic list — here she is actively waiting
          for an answer. Typed-but-unsent text survives the refresh. */}
      <AutoRefresh seconds={10} />
    </div>
  );
}
