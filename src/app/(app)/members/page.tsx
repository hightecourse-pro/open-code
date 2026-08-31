import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { MemberCard, type DirectoryMember } from "@/components/patterns/member-card";
import { MembersInstantList } from "@/components/patterns/members-instant-list";
import { mentorScores } from "@/lib/mentor-score";

export const metadata: Metadata = { title: "המשתתפות שלנו" };

/** PostgREST page size — the loop below walks pages until it drains. */
const PAGE = 500;

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
  const canChat = isSubscriber(me);
  const mentorWaiting = me.role === "mentor" && !canChat;
  const supabase = await createClient();

  // members_directory — never `profiles`: the view carries no `status` or
  // `member_tier`; the ONE payment fact it exposes is the deliberate
  // is_subscriber badge. Since 31/8 it lists pending members too — the owner:
  // "אמורים לראות את כולן".
  // (Before the migration runs this returns nothing and the empty state shows.)
  //
  // The WHOLE directory loads, paged behind the scenes (the owner, 1/9:
  // "תביא את המספר המלא, אם נדרש בפייג'ינג נסתר") — the old 200-row cap
  // silently hid everyone past the first page. The search box still filters
  // client-side over what is now the complete list; ?q= from old links keeps
  // narrowing on the server too.
  const serverNeedle = (q ?? "").trim().slice(0, 60);
  const data: DirectoryMember[] = [];
  for (let from = 0; ; from += PAGE) {
    let pageQuery = supabase
      .from("members_directory")
      .select("id, full_name, first_name, avatar_initials, specialization, region, role, bio, created_at, is_subscriber")
      .neq("id", me.id)
      .order("full_name", { ascending: true })
      .range(from, from + PAGE - 1);
    if (serverNeedle) {
      pageQuery = pageQuery.or(
        `full_name.ilike.%${serverNeedle}%,specialization.ilike.%${serverNeedle}%,region.ilike.%${serverNeedle}%`
      );
    }
    const { data: page } = await pageQuery;
    data.push(...((page ?? []) as DirectoryMember[]));
    if (!page || page.length < PAGE) break;
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
      <MembersInstantList
        capped={false}
        initialQuery={(q ?? "").trim()}
        initialGroup={initialGroup}
        items={members.map((member) => ({
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
              canChat={canChat}
              mentorWaiting={mentorWaiting}
              score={scores.get(member.id)?.score}
              subscriber={subscriberIds.has(member.id)}
              viewerIsTeam={me.role === "admin"}
              studyPlace={studyOf.get(member.id) ?? null}
              city={cityOf.get(member.id) ?? null}
            />
          ),
        }))}
      />
    </div>
  );
}
