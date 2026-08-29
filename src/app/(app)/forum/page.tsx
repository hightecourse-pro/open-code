import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ComposerFold } from "@/components/patterns/composer-fold";
import { ForumInstantList } from "@/components/patterns/forum-instant-list";
import { AutoRefresh } from "@/components/patterns/auto-refresh";
import { ForumTopicRow, topicTitle, type ForumTopic } from "@/components/patterns/forum-topic-row";
import { TargetedJobBanner, type TargetedJobLite } from "@/components/patterns/targeted-job-banner";
import { UpgradeCard } from "@/components/patterns/upgrade-prompt";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = { title: "פורום" };
// Always fresh — a new topic shows without a manual refresh.
export const dynamic = "force-dynamic";

type ProfileLite = {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  role: UserRole;
  specialization: string | null;
};

/** The saved toggle is the only URL state left — search filters client-side. */
function forumHref(params: { saved?: boolean }): string {
  return params.saved ? "/forum?saved=1" : "/forum";
}

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string }>;
}) {
  const { q, saved } = await searchParams;
  // The topic search is instant and client-side now (ForumInstantList) — an
  // incoming ?q= from an old link still pre-fills the box.
  const initialQuery = (q ?? "").trim();

  const supabase = await createClient();
  const profile = await requireCommunityAccess();
  const canWrite = isSubscriber(profile);
  // Saving a topic is a subscriber's action (RLS), so only she has a list.
  const savedOnly = saved === "1" && canWrite;

  // Independent reads run as ONE parallel wave — the targeted-jobs banner and
  // the topic list used to chain round trips before anything below could
  // start. (The hired celebration floats app-wide now — see the layout.)
  const [targetedJobs, posts] = await Promise.all([
    // Jobs published specifically to this member (job_targets — RLS lets her
    // read her own rows). Shown as a prominent banner above the topic list.
    (async (): Promise<TargetedJobLite[]> => {
      const { data: myTargets } = await supabase
        .from("job_targets")
        .select("job_id")
        .eq("profile_id", profile.id);
      const targetIds = (myTargets ?? []).map((t) => t.job_id);
      if (targetIds.length === 0) return [];
      const { data: tJobs } = await supabase
        .from("jobs")
        .select("id, title, company")
        .in("id", targetIds)
        .eq("status", "open")
        .eq("source", "ours")
        .eq("pipeline_status", "published")
        .order("published_at", { ascending: false });
      return tJobs ?? [];
    })(),

    // The topic list itself. The saved filter narrows the query — applied
    // after .limit(50) it would silently pick from the newest 50 topics
    // instead of all of them, so the bookmark ids (reactions kind='save', the
    // only place they are ever read back into a list) resolve first inside
    // this branch. Free-text search is different by design: it runs
    // client-side, instantly, over the topics that are loaded — i.e. over
    // this capped list of 50, not the whole archive (ForumInstantList notes
    // the same on its side).
    (async () => {
      let savedIds: string[] = [];
      if (savedOnly) {
        const { data: saves } = await supabase
          .from("reactions")
          .select("post_id")
          .eq("profile_id", profile.id)
          .eq("kind", "save");
        savedIds = (saves ?? []).map((s) => s.post_id);
        if (savedIds.length === 0) return [];
      }
      let topicsQuery = supabase
        .from("posts")
        .select("id, body, intent, tech_tags, is_official, is_pinned, created_at, author_id, reply_count, like_count, last_reply_at")
        .eq("kind", "forum");
      if (savedOnly) topicsQuery = topicsQuery.in("id", savedIds);
      const { data } = await topicsQuery
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    })(),
  ]);

  const authorIds = [...new Set(posts.map((p) => p.author_id))];

  // The list needs numbers, not content — and since 2026-08-29 the numbers
  // live ON the post (reply_count / like_count / last_reply_at, maintained by
  // triggers). No more fetching every comment and reaction row of 50 topics
  // just to count them (that fetch silently truncated at 1000 rows).
  const { data: authorRows } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, avatar_initials, role, specialization")
        .in("id", authorIds)
    : { data: [] };

  const authors = (authorRows ?? []) as ProfileLite[];
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  const topics: ForumTopic[] = posts.map((p) => ({
    id: p.id,
    title: topicTitle(p.body),
    intent: p.intent,
    tech_tags: p.tech_tags,
    is_official: p.is_official,
    is_pinned: p.is_pinned,
    created_at: p.created_at,
    last_activity_at: p.last_reply_at ?? p.created_at,
    author: authorMap.get(p.author_id) ?? null,
    replyCount: p.reply_count ?? 0,
    likeCount: p.like_count ?? 0,
  }));
  // Pinned stay on top; inside each group the freshest conversation wins.
  topics.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
  });
  // Search haystack: title + the opening of the body. Shipping every full
  // body (up to 5,000 chars each) doubled the page for text nobody sees —
  // the opening covers the overwhelming majority of real matches.
  const bodyById = new Map(posts.map((p) => [p.id, p.body.slice(0, 300)]));

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh seconds={30} />
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;פורום/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">הפורום</h1>
        <p className="t-body-sm text-ink-700">
          שאלות, התייעצויות ושיתופי ידע — אנחנו פה אחת בשביל השנייה. לחצי על נושא כדי לקרוא את
          השיחה כולה.
        </p>
      </div>

      <TargetedJobBanner jobs={targetedJobs} />

      {!canWrite && (
        <UpgradeCard
          title="השיחות בפורום נפתחות עם מנוי 💜"
          body="כאן חברות הקהילה מתייעצות, שואלות ומשתפות ידע. עם מנוי תוכלי לקרוא את כל השיחות — וגם להצטרף אליהן."
          cta="להצטרפות"
        />
      )}

      {/* Instant search over the loaded topics — rows and empty states are
          prepared here; typing only shows/hides them, nothing navigates.
          The composer rides in the belowSearch slot (PM: search on top,
          "פתחי פוסט" under it), and the saved view drops it — noise on top
          of a list she came to read. */}
      <ForumInstantList
        canWrite={canWrite}
        savedOnly={savedOnly}
        initialQuery={initialQuery}
        belowSearch={canWrite && !savedOnly ? <ComposerFold kind="forum" /> : undefined}
        chips={
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "כל הנושאים", href: forumHref({}), on: !savedOnly },
              { label: "הנושאים ששמרתי 🔖", href: forumHref({ saved: true }), on: savedOnly },
            ].map((chip) => (
              <Link
                key={chip.label}
                href={chip.href}
                className={
                  chip.on
                    ? "font-display font-semibold text-[13px] px-3.5 py-[7px] rounded-full border-[1.5px] border-transparent bg-brand-gradient text-white"
                    : "font-display font-semibold text-[13px] px-3.5 py-[7px] rounded-full border-[1.5px] border-ink-200 bg-white text-ink-700 hover:border-brand-purple transition-colors"
                }
              >
                {chip.label}
              </Link>
            ))}
          </div>
        }
        items={topics.map((t) => ({
          id: t.id,
          // She searches the whole body ("בנושא או בתוכן") — the visible row
          // title is just its first line.
          haystack: bodyById.get(t.id) ?? t.title,
          node: <ForumTopicRow topic={t} />,
        }))}
      />
    </div>
  );
}
