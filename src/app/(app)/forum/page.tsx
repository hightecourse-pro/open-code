import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Composer } from "@/components/patterns/composer";
import { AutoRefresh } from "@/components/patterns/auto-refresh";
import { ForumTopicRow, topicTitle, type ForumTopic } from "@/components/patterns/forum-topic-row";
import { TargetedJobBanner, type TargetedJobLite } from "@/components/patterns/targeted-job-banner";
import { HiredBanner } from "@/components/patterns/hired-banner";
import { UpgradeCard } from "@/components/patterns/upgrade-prompt";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = { title: "פורום" };
// Always fresh — a new topic shows without a manual refresh.
export const dynamic = "force-dynamic";

/** ISO cutoff for the hired-celebration window — the last 60 days. */
function hiredCelebrationSince(): string {
  return new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
}

type ProfileLite = {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  role: UserRole;
  specialization: string | null;
};

export default async function ForumPage() {
  const supabase = await createClient();
  const profile = await requireCommunityAccess();
  const canWrite = isSubscriber(profile);

  // Jobs published specifically to this member (job_targets — RLS lets her
  // read her own rows). Shown as a prominent banner above the topic list.
  let targetedJobs: TargetedJobLite[] = [];
  const { data: myTargets } = await supabase
    .from("job_targets")
    .select("job_id")
    .eq("profile_id", profile.id);
  const targetIds = (myTargets ?? []).map((t) => t.job_id);
  if (targetIds.length > 0) {
    const { data: tJobs } = await supabase
      .from("jobs")
      .select("id, title, company")
      .in("id", targetIds)
      .eq("status", "open")
      .eq("source", "ours")
      .eq("pipeline_status", "published")
      .order("published_at", { ascending: false });
    targetedJobs = tJobs ?? [];
  }

  // Women who recently started a job — the whole community celebrates. Two
  // sources: members (profiles) and off-community placements (manual_hires,
  // admin-only RLS → service role; banner names are public by design).
  // Names only — workplace is never shown to other members.
  const hiredSince = hiredCelebrationSince();
  const [{ data: hiredMembers }, { data: manualHires }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, hired_at")
      .eq("found_job", true)
      .gte("hired_at", hiredSince)
      .order("hired_at", { ascending: false })
      .limit(6),
    createAdminClient()
      .from("manual_hires")
      .select("full_name, hired_at")
      .gte("hired_at", hiredSince)
      .order("hired_at", { ascending: false })
      .limit(6),
  ]);
  const recentlyHired = [...(hiredMembers ?? []), ...(manualHires ?? [])]
    .filter((h) => !!h.hired_at)
    .sort((a, b) => new Date(b.hired_at!).getTime() - new Date(a.hired_at!).getTime())
    .slice(0, 6)
    .map((h) => ({ full_name: h.full_name }));

  const { data: posts } = await supabase
    .from("posts")
    .select("id, body, intent, tech_tags, is_official, is_pinned, created_at, author_id")
    .eq("kind", "forum")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const postIds = (posts ?? []).map((p) => p.id);

  // The list needs numbers, not content: reply count + last activity per
  // topic, and like counts. The replies themselves load on the topic page.
  const [{ data: commentMeta }, { data: reactions }] = await Promise.all([
    postIds.length
      ? supabase
          .from("comments")
          .select("post_id, created_at")
          .in("post_id", postIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    postIds.length
      ? supabase.from("reactions").select("post_id, kind").in("post_id", postIds).eq("kind", "like")
      : Promise.resolve({ data: [] }),
  ]);

  const replyCount = new Map<string, number>();
  const lastReplyAt = new Map<string, string>();
  for (const c of commentMeta ?? []) {
    replyCount.set(c.post_id, (replyCount.get(c.post_id) ?? 0) + 1);
    lastReplyAt.set(c.post_id, c.created_at); // ascending order → ends on the newest
  }
  const likeCount = new Map<string, number>();
  for (const r of reactions ?? []) likeCount.set(r.post_id, (likeCount.get(r.post_id) ?? 0) + 1);

  const authorIds = [...new Set((posts ?? []).map((p) => p.author_id))];
  let authors: ProfileLite[] = [];
  if (authorIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_initials, role, specialization")
      .in("id", authorIds);
    authors = (data ?? []) as ProfileLite[];
  }
  const authorMap = new Map(authors.map((a) => [a.id, a]));

  const topics: ForumTopic[] = (posts ?? []).map((p) => ({
    id: p.id,
    title: topicTitle(p.body),
    intent: p.intent,
    tech_tags: p.tech_tags,
    is_official: p.is_official,
    is_pinned: p.is_pinned,
    created_at: p.created_at,
    last_activity_at: lastReplyAt.get(p.id) ?? p.created_at,
    author: authorMap.get(p.author_id) ?? null,
    replyCount: replyCount.get(p.id) ?? 0,
    likeCount: likeCount.get(p.id) ?? 0,
  }));
  // Pinned stay on top; inside each group the freshest conversation wins.
  topics.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
  });

  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh />
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;פורום/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">הפורום</h1>
        <p className="t-body-sm text-ink-700">
          שאלות, התייעצויות ושיתופי ידע — אנחנו פה אחת בשביל השנייה. לחצי על נושא כדי לקרוא את
          השיחה כולה.
        </p>
      </div>

      <TargetedJobBanner jobs={targetedJobs} />

      <HiredBanner members={recentlyHired} />

      {canWrite ? (
        <Composer kind="forum" />
      ) : (
        <UpgradeCard
          title="את מוזמנת לקרוא הכול 💜"
          body="כתיבה בפורום, תגובות והתייעצויות נפתחות עם מנוי — ואנחנו נשמח לשמוע גם אותך."
          cta="להצטרפות"
        />
      )}

      {topics.length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          {canWrite
            ? "הפורום שקט עכשיו — אולי דווקא את תפתחי את השיחה הראשונה?"
            : "הפורום שקט עכשיו — בקרוב יהיה כאן מלא."}
        </div>
      ) : (
        <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm overflow-hidden divide-y divide-ink-100">
          <div className="flex items-center px-4 py-2.5 text-[11.5px] font-bold text-ink-400 uppercase tracking-wide bg-ink-50/60">
            <span className="flex-1">נושא</span>
            <span className="w-20 text-center">תגובות</span>
            <span className="hidden md:block w-16 text-end">פעילות</span>
          </div>
          {topics.map((t) => (
            <ForumTopicRow key={t.id} topic={t} />
          ))}
        </div>
      )}
    </div>
  );
}
