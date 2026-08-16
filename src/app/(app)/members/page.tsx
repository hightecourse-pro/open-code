import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { Button } from "@/components/ui";
import { MemberCard, type DirectoryMember } from "@/components/patterns/member-card";

export const metadata: Metadata = { title: "המשתתפות שלנו" };

/** Plenty for browsing; a bigger community reaches for the search box. */
const MAX_RESULTS = 200;

/**
 * PostgREST splits an `or=(…)` filter on commas and parentheses, so a search
 * like "Node (React), מרכז" would break it — double quotes keep the value
 * whole. Only `"` and `\` need escaping inside them.
 */
function searchFilter(needle: string): string {
  const pattern = `%${needle.replace(/["\\]/g, "\\$&")}%`;
  return ["full_name", "specialization", "region"]
    .map((column) => `${column}.ilike."${pattern}"`)
    .join(",");
}

/** "נמצאו 12 משתתפות" while searching, plain "12 משתתפות" while browsing. */
function countLabel(count: number, searching: boolean): string {
  if (count === 0) return searching ? "לא נמצאו משתתפות" : "אין עדיין משתתפות";
  if (count === 1) return searching ? "נמצאה משתתפת אחת" : "משתתפת אחת";
  return `${searching ? "נמצאו " : ""}${count} משתתפות`;
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const needle = (q ?? "").trim();

  const me = await requireCommunityAccess();
  const canChat = isSubscriber(me);
  const supabase = await createClient();

  // members_directory — never `profiles`: the view simply doesn't carry
  // `status` or `member_tier`, so nobody can tell from here who pays.
  // (Before the migration runs this returns nothing and the empty state shows.)
  let query = supabase
    .from("members_directory")
    .select("id, full_name, first_name, avatar_initials, specialization, region, role, bio, created_at")
    .neq("id", me.id)
    .order("full_name", { ascending: true })
    .limit(MAX_RESULTS);
  if (needle) query = query.or(searchFilter(needle));

  const { data } = await query;
  // Hebrew alphabetical — the database collation isn't necessarily Hebrew-aware.
  const members: DirectoryMember[] = (data ?? []).sort((a, b) =>
    a.full_name.localeCompare(b.full_name, "he")
  );
  const capped = members.length === MAX_RESULTS;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;קהילה/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">המשתתפות שלנו 💜</h1>
        <p className="t-body-sm text-ink-700">
          כל מי שנמצאת כאן איתנו. חפשי לפי שם, תחום או אזור — ואם בא לך להכיר, אפשר לכתוב לה ישירות.
        </p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-4 shadow-sm flex flex-col gap-2.5">
        <form className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              name="q"
              defaultValue={q ?? ""}
              autoComplete="off"
              aria-label="חיפוש משתתפת"
              placeholder="חיפוש לפי שם, תחום או אזור…"
              className="w-full text-sm border border-ink-300 rounded-md ps-9 pe-3 py-2.5 outline-none focus:border-brand-purple"
            />
          </div>
          <Button type="submit" size="sm">
            חיפוש
          </Button>
        </form>
        <div className="flex items-center gap-3 flex-wrap text-[12.5px] text-ink-500">
          <span>
            {countLabel(members.length, !!needle)}
            {capped && " ראשונות — החיפוש יביא אותך ישר למי שאת מחפשת"}
          </span>
          {needle && (
            <Link href="/members" className="font-semibold text-brand-purple hover:underline">
              ניקוי החיפוש
            </Link>
          )}
        </div>
      </div>

      {members.length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          {needle
            ? "לא מצאנו משתתפת שמתאימה לחיפוש — אולי לנסות שם אחר, תחום או אזור? 💜"
            : "רשימת המשתתפות עוד מתמלאת — בקרוב תמצאי כאן את כל מי שאיתנו 💜"}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {members.map((member) => (
            <MemberCard key={member.id} member={member} canChat={canChat} />
          ))}
        </div>
      )}
    </div>
  );
}
