import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { Composer } from "@/components/patterns/composer";
import { PostCard, type FeedPost } from "@/components/patterns/post-card";
import type { PostComment } from "@/components/patterns/post-interactions";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = { title: "פורום" };

type ProfileLite = {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  role: UserRole;
  specialization: string | null;
};

export default async function ForumPage() {
  const supabase = await createClient();
  const user = await getUser();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, body, intent, tech_tags, is_official, is_pinned, created_at, author_id")
    .eq("kind", "forum")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const postIds = (posts ?? []).map((p) => p.id);

  // Reactions + comments for the visible posts (small sets; fine to load).
  const [{ data: reactions }, { data: comments }] = await Promise.all([
    postIds.length
      ? supabase.from("reactions").select("post_id, profile_id, kind").in("post_id", postIds)
      : Promise.resolve({ data: [] }),
    postIds.length
      ? supabase
          .from("comments")
          .select("id, post_id, body, author_id, created_at")
          .in("post_id", postIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  // Resolve all authors (posts + comments) in one query.
  const authorIds = [
    ...new Set([
      ...(posts ?? []).map((p) => p.author_id),
      ...(comments ?? []).map((c) => c.author_id),
    ]),
  ];
  let authors: ProfileLite[] = [];
  if (authorIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, role, specialization")
      .in("id", authorIds);
    authors = (data ?? []) as ProfileLite[];
  }
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  const commentsByPost = new Map<string, PostComment[]>();
  for (const c of comments ?? []) {
    const a = authorMap.get(c.author_id);
    const arr = commentsByPost.get(c.post_id) ?? [];
    arr.push({
      id: c.id,
      body: c.body,
      author_name: a?.full_name ?? "חברת קהילה",
      author_initials: a?.avatar_initials ?? null,
      created_at: c.created_at,
    });
    commentsByPost.set(c.post_id, arr);
  }

  const forumPosts: FeedPost[] = (posts ?? []).map((p) => {
    const rx = (reactions ?? []).filter((r) => r.post_id === p.id);
    return {
      id: p.id,
      body: p.body,
      intent: p.intent,
      tech_tags: p.tech_tags,
      is_official: p.is_official,
      is_pinned: p.is_pinned,
      created_at: p.created_at,
      author: authorMap.get(p.author_id) ?? null,
      likeCount: rx.filter((r) => r.kind === "like").length,
      liked: !!user && rx.some((r) => r.kind === "like" && r.profile_id === user.id),
      saved: !!user && rx.some((r) => r.kind === "save" && r.profile_id === user.id),
      comments: commentsByPost.get(p.id) ?? [],
    };
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;פורום/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">הפורום</h1>
        <p className="t-body-sm text-ink-700">שאלות, התייעצויות ושיתופי ידע — אנחנו פה אחת בשביל השנייה.</p>
      </div>

      <Composer kind="forum" />

      {forumPosts.length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          הפורום שקט עכשיו — מה אם תפתחי את השיחה הראשונה היום?
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {forumPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
