import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Composer } from "@/components/patterns/composer";
import { PostCard, type FeedPost } from "@/components/patterns/post-card";

export const metadata: Metadata = { title: "פורום" };

type PostAuthor = NonNullable<FeedPost["author"]> & { id: string };

export default async function ForumPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, body, intent, tech_tags, is_official, is_pinned, created_at, author_id")
    .eq("kind", "forum")
    .order("created_at", { ascending: false })
    .limit(50);

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

  const forumPosts: FeedPost[] = (posts ?? []).map((p) => ({
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
