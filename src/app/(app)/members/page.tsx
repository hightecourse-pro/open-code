import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { MemberCard, type DirectoryMember } from "@/components/patterns/member-card";
import { MembersInstantList } from "@/components/patterns/members-instant-list";
import { mentorScores } from "@/lib/mentor-score";

export const metadata: Metadata = { title: "המשתתפות שלנו" };

/** Plenty for browsing; a bigger community reaches for the search box. */
const MAX_RESULTS = 200;

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

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
  // The whole directory loads once (up to MAX_RESULTS) and the search box
  // filters it client-side as she types (MembersInstantList) — instant, no
  // URL writes. That means the search only sees the loaded rows; today's
  // community fits well inside the cap.
  // A ?q= runs the search on the SERVER over the whole community — the
  // instant client filter only sees the loaded page, and past a few hundred
  // members that page stops covering everyone (the ~93%-invisible problem).
  const serverNeedle = (q ?? "").trim().slice(0, 60);
  let directoryQuery = supabase
    .from("members_directory")
    .select("id, full_name, first_name, avatar_initials, specialization, region, role, bio, created_at, is_subscriber")
    .neq("id", me.id)
    .order("full_name", { ascending: true })
    .limit(MAX_RESULTS);
  if (serverNeedle) {
    directoryQuery = directoryQuery.or(
      `full_name.ilike.%${serverNeedle}%,specialization.ilike.%${serverNeedle}%,region.ilike.%${serverNeedle}%`
    );
  }
  const { data } = await directoryQuery;
  // Hebrew alphabetical — the database collation isn't necessarily Hebrew-aware.
  const members: DirectoryMember[] = (data ?? []).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "he")
  );
  const capped = members.length === MAX_RESULTS;

  // Mentor scores are public — the directory card carries them.
  const scores = await mentorScores(members.filter((m) => m.role === "mentor").map((m) => m.id));

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
          כל מי שנמצאת כאן איתנו. חפשי לפי שם, תחום או אזור — ואם בא לך להכיר, אפשר לכתוב לה ישירות.
        </p>
      </div>

      {/* Instant search — she types, the cards narrow, nothing navigates.
          An incoming ?q= from an old link still pre-fills the box. */}
      <MembersInstantList
        capped={capped}
        initialQuery={(q ?? "").trim()}
        items={members.map((member) => ({
          id: member.id,
          haystack: [member.full_name, member.specialization ?? "", member.region ?? ""].join(" "),
          node: (
            <MemberCard
              member={member}
              canChat={canChat}
              mentorWaiting={mentorWaiting}
              score={scores.get(member.id)?.score}
              subscriber={subscriberIds.has(member.id)}
              viewerIsTeam={me.role === "admin"}
            />
          ),
        }))}
      />
    </div>
  );
}
