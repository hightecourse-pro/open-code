import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { MemberCard, type DirectoryMember } from "@/components/patterns/member-card";
import { MembersInstantList, type GroupCounts } from "@/components/patterns/members-instant-list";
import { mentorScores } from "@/lib/mentor-score";
import type { InstantItem } from "@/components/patterns/instant-filter";

export const metadata: Metadata = { title: "המשתתפות שלנו" };

/** PostgREST page size — the loop below walks pages until it drains. */
const PAGE = 500;
/** What the first paint carries while the full list streams in behind it. */
const FIRST_CHUNK = 60;

interface Viewer {
  id: string;
  canChat: boolean;
  mentorWaiting: boolean;
  isTeam: boolean;
}

/**
 * Load directory members (optionally only the first chunk) with everything the
 * card shows: score, study place, city, the מנויה badge. Shared by the instant
 * first paint and the full streamed list — same enrichment, different size.
 */
async function loadDirectoryItems(
  viewer: Viewer,
  serverNeedle: string,
  limit?: number
): Promise<InstantItem[]> {
  const supabase = await createClient();

  // members_directory — never `profiles`: the view carries no `status` or
  // `member_tier`; the ONE payment fact it exposes is the deliberate
  // is_subscriber badge. Since 31/8 it lists pending members too — the owner:
  // "אמורים לראות את כולן".
  const data: DirectoryMember[] = [];
  for (let from = 0; ; from += PAGE) {
    const pageSize = limit ? Math.min(PAGE, limit - data.length) : PAGE;
    if (pageSize <= 0) break;
    let pageQuery = supabase
      .from("members_directory")
      .select("id, full_name, first_name, avatar_initials, specialization, region, role, created_at, is_subscriber")
      .neq("id", viewer.id)
      .order("full_name", { ascending: true })
      .range(from, from + pageSize - 1);
    if (serverNeedle) {
      pageQuery = pageQuery.or(
        `full_name.ilike.%${serverNeedle}%,specialization.ilike.%${serverNeedle}%,region.ilike.%${serverNeedle}%`
      );
    }
    const { data: page } = await pageQuery;
    data.push(...((page ?? []) as DirectoryMember[]));
    if (!page || page.length < pageSize || (limit && data.length >= limit)) break;
  }
  // Hebrew alphabetical — the database collation isn't necessarily Hebrew-aware.
  const members: DirectoryMember[] = data.sort((a, b) => a.full_name.localeCompare(b.full_name, "he"));

  // Mentor scores are public — the directory card carries them.
  const scores = await mentorScores(members.filter((m) => m.role === "mentor").map((m) => m.id));

  // Study place + city on the card (the owner, 1/9 + 31/8: עיר במקום אזור) —
  // stored as the selects' VALUEs in profile_answers; resolved to labels here
  // with the service role (answers aren't member-readable) and passed per card.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminC = createAdminClient();
  const { data: cardQs } = await adminC
    .from("config_questions")
    .select("id, key, options")
    .in("key", ["study_place", "city"]);
  const studyOf = new Map<string, string>();
  const cityOf = new Map<string, string>();
  for (const q of cardQs ?? []) {
    if (!members.length) break;
    const into = q.key === "city" ? cityOf : studyOf;
    const labelOf = new Map(
      (Array.isArray(q.options) ? (q.options as unknown as { value: string; label: string }[]) : []).map(
        (o) => [o.value, o.label]
      )
    );
    for (let i = 0; i < members.length; i += 500) {
      const { data: ans } = await adminC
        .from("profile_answers")
        .select("profile_id, value")
        .eq("question_id", q.id)
        .in("profile_id", members.slice(i, i + 500).map((m) => m.id));
      for (const a of ans ?? []) {
        if (typeof a.value === "string" && a.value) into.set(a.profile_id, labelOf.get(a.value) ?? a.value);
      }
    }
  }

  // Who is a paying subscriber — since 31/8 the view computes it (activated
  // paid junior / live subscription / on the Nedarim payers list), so a
  // PENDING member who already paid is labeled מנויה too (the owner's ask).
  const subscriberIds = new Set(members.filter((m) => m.is_subscriber === true).map((m) => m.id));

  return members.map((member) => ({
    id: member.id,
    // One-click chips: the view's masked role means "mentor" is always
    // an APPROVED mentor; מנויות = the honest is_subscriber badge.
    group:
      member.role === "admin"
        ? "team"
        : member.role === "mentor"
          ? "mentor"
          : subscriberIds.has(member.id)
            ? "subscriber"
            : "member",
    haystack: [member.full_name, member.specialization ?? "", member.region ?? "", cityOf.get(member.id) ?? "", studyOf.get(member.id) ?? ""].join(" "),
    node: (
      <MemberCard
        member={member}
        canChat={viewer.canChat}
        mentorWaiting={viewer.mentorWaiting}
        score={scores.get(member.id)?.score}
        subscriber={subscriberIds.has(member.id)}
        viewerIsTeam={viewer.isTeam}
        studyPlace={studyOf.get(member.id) ?? null}
        city={cityOf.get(member.id) ?? null}
      />
    ),
  }));
}

/** The complete directory, streamed in behind the instant first chunk. */
async function FullDirectory({
  viewer,
  serverNeedle,
  counts,
  initialQuery,
  initialGroup,
}: {
  viewer: Viewer;
  serverNeedle: string;
  counts: GroupCounts;
  initialQuery: string;
  initialGroup: string;
}) {
  const items = await loadDirectoryItems(viewer, serverNeedle);
  return (
    <MembersInstantList
      capped={false}
      counts={counts}
      initialQuery={initialQuery}
      initialGroup={initialGroup}
      items={items}
    />
  );
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; g?: string }>;
}) {
  const { q, g } = await searchParams;
  // The chip filter survives the round-trip to a member's page (?g= written
  // client-side with replaceState) — validate to the known groups.
  const initialGroup = ["subscriber", "mentor", "team"].includes(g ?? "") ? g! : "";

  const me = await requireCommunityAccess();
  const viewer: Viewer = {
    id: me.id,
    canChat: isSubscriber(me),
    mentorWaiting: me.role === "mentor" && !isSubscriber(me),
    isTeam: me.role === "admin",
  };
  const serverNeedle = (q ?? "").trim().slice(0, 60);
  const supabase = await createClient();

  // The TRUE numbers, fetched up front (the owner, 10/9: "רק שהמספרים הנכונים
  // תשלוף מראש") — cheap head-counts on the view, so the chips are right from
  // the first paint even while most of the list is still streaming in.
  const countBase = () =>
    supabase.from("members_directory").select("id", { count: "exact", head: true }).neq("id", me.id);
  const [{ count: allC }, { count: mentorC }, { count: teamC }, { count: subC }] = await Promise.all([
    countBase(),
    countBase().eq("role", "mentor"),
    countBase().eq("role", "admin"),
    countBase().eq("role", "junior").eq("is_subscriber", true),
  ]);
  const counts: GroupCounts = {
    all: allC ?? 0,
    mentor: mentorC ?? 0,
    team: teamC ?? 0,
    subscriber: subC ?? 0,
  };

  // The first chunk renders IMMEDIATELY (the owner, 10/9: "לא יכול להיות
  // שנכנסים ורואים ריק") — the rest of the directory streams in behind it
  // via Suspense and replaces the list when ready.
  const firstItems = await loadDirectoryItems(viewer, serverNeedle, FIRST_CHUNK);
  const partial = counts.all > firstItems.length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;קהילה/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">המשתתפות שלנו 💜</h1>
        <p className="t-body-sm text-ink-700">
          כל מי שנמצאת כאן איתנו. חפשי לפי שם, תחום או עיר — ואם בא לך להכיר, אפשר לכתוב לה ישירות.
        </p>
      </div>

      {/* Instant search — she types, the cards narrow, nothing navigates.
          An incoming ?q= from an old link still pre-fills the box. */}
      {partial ? (
        <Suspense
          fallback={
            <MembersInstantList
              capped={false}
              counts={counts}
              loadingAll
              initialQuery={(q ?? "").trim()}
              initialGroup={initialGroup}
              items={firstItems}
            />
          }
        >
          <FullDirectory
            viewer={viewer}
            serverNeedle={serverNeedle}
            counts={counts}
            initialQuery={(q ?? "").trim()}
            initialGroup={initialGroup}
          />
        </Suspense>
      ) : (
        <MembersInstantList
          capped={false}
          counts={counts}
          initialQuery={(q ?? "").trim()}
          initialGroup={initialGroup}
          items={firstItems}
        />
      )}
    </div>
  );
}
