import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui";
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

/** `%` and `_` are ilike wildcards — a member who types them means the characters. */
function likePattern(needle: string): string {
  return `%${needle.replace(/[\\%_]/g, "\\$&")}%`;
}

/** "נמצאו 7 נושאים" while searching, plain "7 נושאים" while browsing. */
function countLabel(count: number, searching: boolean): string {
  if (count === 0) return searching ? "לא נמצאו נושאים" : "אין עדיין נושאים";
  if (count === 1) return searching ? "נמצא נושא אחד" : "נושא אחד";
  return `${searching ? "נמצאו " : ""}${count} נושאים`;
}

/** Keep the other filter alive when she switches this one. */
function forumHref(params: { q?: string; saved?: boolean }): string {
  const search = new URLSearchParams();
  if (params.saved) search.set("saved", "1");
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `/forum?${qs}` : "/forum";
}

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; saved?: string }>;
}) {
  const { q, saved } = await searchParams;
  const needle = (q ?? "").trim();

  const supabase = await createClient();
  const profile = await requireCommunityAccess();
  const canWrite = isSubscriber(profile);
  // Saving a topic is a subscriber's action (RLS), so only she has a list.
  const savedOnly = saved === "1" && canWrite;
  const filtering = !!needle || savedOnly;

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

  // The topics she bookmarked (reactions kind='save') — the only place they
  // are ever read back into a list.
  let savedIds: string[] = [];
  if (savedOnly) {
    const { data: saves } = await supabase
      .from("reactions")
      .select("post_id")
      .eq("profile_id", profile.id)
      .eq("kind", "save");
    savedIds = (saves ?? []).map((s) => s.post_id);
  }

  // Both filters narrow the query itself — applied after .limit(50) they would
  // silently search inside the newest 50 topics instead of all of them.
  let topicsQuery = supabase
    .from("posts")
    .select("id, body, intent, tech_tags, is_official, is_pinned, created_at, author_id")
    .eq("kind", "forum");
  if (needle) topicsQuery = topicsQuery.ilike("body", likePattern(needle));
  if (savedOnly) topicsQuery = topicsQuery.in("id", savedIds);

  const { data: posts } =
    savedOnly && savedIds.length === 0
      ? { data: [] }
      : await topicsQuery
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
        // While she's searching or looking at what she saved, the box would
        // just be noise on top of a list she came to read.
        !filtering && <Composer kind="forum" />
      ) : (
        <UpgradeCard
          title="השיחות בפורום נפתחות עם מנוי 💜"
          body="כאן חברות הקהילה מתייעצות, שואלות ומשתפות ידע. עם מנוי תוכלי לקרוא את כל השיחות — וגם להצטרף אליהן."
          cta="להצטרפות"
        />
      )}

      {canWrite && (
        <div className="bg-white border border-ink-200 rounded-[18px] p-4 shadow-sm flex flex-col gap-2.5">
          <form className="flex items-center gap-2">
            {savedOnly && <input type="hidden" name="saved" value="1" />}
            <div className="relative flex-1">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                name="q"
                defaultValue={needle}
                autoComplete="off"
                aria-label="חיפוש נושא בפורום"
                placeholder="חיפוש לפי מילה בנושא או בתוכן…"
                className="w-full text-sm border border-ink-300 rounded-md ps-9 pe-3 py-2.5 outline-none focus:border-brand-purple"
              />
            </div>
            <Button type="submit" size="sm">
              חיפוש
            </Button>
          </form>

          <div className="flex gap-2 flex-wrap">
            {[
              { label: "כל הנושאים", href: forumHref({ q: needle }), on: !savedOnly },
              { label: "הנושאים ששמרתי 🔖", href: forumHref({ q: needle, saved: true }), on: savedOnly },
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

          <div className="flex items-center gap-3 flex-wrap text-[12.5px] text-ink-500">
            <span>{countLabel(topics.length, !!needle)}</span>
            {needle && (
              <Link
                href={forumHref({ saved: savedOnly })}
                className="font-semibold text-brand-purple hover:underline"
              >
                ניקוי החיפוש
              </Link>
            )}
          </div>
        </div>
      )}

      {topics.length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          {needle
            ? "לא מצאנו נושא שמתאים לחיפוש — אולי לנסות מילה אחרת? 💜"
            : savedOnly
              ? "עוד לא שמרת נושאים. בכל שיחה יש כפתור שמירה 🔖 — מה שתשמרי יחכה לך כאן 💜"
              : canWrite
                ? "הפורום שקט עכשיו — אולי דווקא את תפתחי את השיחה הראשונה?"
                : "השיחות של הקהילה מחכות כאן מאחורי המנוי — נשמח לפתוח לך אותן 💜"}
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
