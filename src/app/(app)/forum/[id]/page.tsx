import type { Metadata } from "next";
import Link from "next/link";
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

async function loadPost(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, body, intent, tech_tags, is_official, is_pinned, created_at, edited_at, author_id")
    .eq("id", id)
    .eq("kind", "forum")
    .maybeSingle();
  return data;
}

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

  const [{ data: reactions }, { data: comments }] = await Promise.all([
    supabase.from("reactions").select("post_id, profile_id, kind").eq("post_id", post.id),
    supabase
      .from("comments")
      .select("id, post_id, body, author_id, created_at, edited_at")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true }),
  ]);

  const authorIds = [...new Set([post.author_id, ...(comments ?? []).map((c) => c.author_id)])];
  const { data: authorRows } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_initials, role, specialization")
    .in("id", authorIds);
  const authorMap = new Map(((authorRows ?? []) as ProfileLite[]).map((a) => [a.id, a]));

  const topicComments: PostComment[] = (comments ?? []).map((c) => {
    const a = authorMap.get(c.author_id);
    return {
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
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/forum"
        className="flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-purple hover:underline w-fit"
      >
        <ArrowRight size={15} />
        חזרה לכל הנושאים
      </Link>

      <PostCard post={feedPost} canWrite={canWrite} defaultOpenComments />
      {/* A conversation, not a page: replies from other members show up on
          their own. Faster than the topic list — here she is actively waiting
          for an answer. Typed-but-unsent text survives the refresh. */}
      <AutoRefresh seconds={10} />
    </div>
  );
}
