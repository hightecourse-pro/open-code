import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Composer } from "@/components/patterns/composer";
import { PostCard, type FeedPost } from "@/components/patterns/post-card";

type PostAuthor = NonNullable<FeedPost["author"]> & { id: string };

export const metadata: Metadata = { title: "פיד הקהילה" };

export default async function FeedPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, body, intent, tech_tags, is_official, is_pinned, created_at, author_id")
    .eq("kind", "feed")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  // Resolve authors in a single follow-up query, then merge in memory.
  const authorIds = [...new Set((posts ?? []).map((p) => p.author_id))];
  let authors: PostAuthor[] = [];

  if (authorIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, role, specialization")
      .in("id", authorIds);
    authors = data ?? [];
  }

  const authorMap = new Map(authors.map((a) => [a.id, a]));

  const feedPosts: FeedPost[] = (posts ?? []).map((p) => ({
    id: p.id,
    body: p.body,
    intent: p.intent,
    tech_tags: p.tech_tags,
    is_official: p.is_official,
    is_pinned: p.is_pinned,
    created_at: p.created_at,
    author: authorMap.get(p.author_id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs text-brand-pink-deep">&lt;פיד/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000">מה חדש בקהילה</h1>
      </div>

      <Composer />

      {feedPosts.length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm">
          <p className="t-body text-ink-700">
            הפיד שקט עכשיו — מה אם תפתחי את השיחה הראשונה היום?
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {feedPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
