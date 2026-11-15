import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { renderStamp } from "@/lib/request-stamp";
import { MembersTable } from "@/components/patterns/members-table";

export const metadata: Metadata = { title: "ניהול חברות" };
// The shell only - the auth check and the deep-linked filter. The list itself
// comes from /api/admin/members (15.11), so this page always paints at once.
export const dynamic = "force-dynamic";

/**
 * /admin/members. Until 15.11 this page assembled every row server-side
 * (profiles, auth emails, phone and study answers, subscriptions, refused
 * charges…) before anything painted - several seconds at 3,000+ members, on
 * every visit and on every background refresh of the page (the owner:
 * ״לחצתי על חברות, הוא מתעדכן… הייתי מצפה שיעבור מיד ויראה מה שיש לו בזכרון
 * ויתעדכן ברקע בלי להפריע״). Now the table fetches the list itself, keeps the
 * last copy in her browser and refreshes it quietly; `renderedAt` changes on
 * every server render of this shell (her own actions revalidate the path, the
 * background refresh re-renders it), and the table refetches on each change.
 */
export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  // The dashboard cubes deep-link here pre-filtered (?status=active/pending).
  const { status: statusParam } = await searchParams;
  const initialStatus = ["active", "pending", "paused", "rejected"].includes(statusParam ?? "")
    ? statusParam!
    : "";
  const profile = await requireRole("admin");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;חברות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול חברות</h1>
        <p className="t-body-sm text-ink-500">
          חיפוש וסינון מיידיים, איתור חברות לפי כל שדה בפרופיל, סימון VIP והערות פנימיות.
        </p>
      </div>

      <MembersTable initialStatus={initialStatus} viewerId={profile.id} renderedAt={renderStamp()} />

      {/* Placements moved to their own screen (the owner, 3/9). */}
      <a href="/admin/hires" className="text-[13px] font-semibold text-brand-purple hover:underline self-start">
        🎉 גיוסים - כל ההשמות, הסטטוסים והחיובים ←
      </a>
    </div>
  );
}
