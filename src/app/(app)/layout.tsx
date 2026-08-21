import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout";
import { ProfileOnboarding } from "@/components/patterns/profile-onboarding";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Messages waiting for her — the same rule the daily digest counts by: in one
 * of her conversations, written by the other side, never read.
 *
 * One head-only count, no explicit conversation filter: messages RLS
 * (messages_select) already scopes every row to a conversation she is part
 * of, so the old two-hop version (fetch her conversation ids, then count
 * inside them) counted exactly the same set one round trip later. Verified
 * against the live DB: both formulas agree for every profile (2026-08-19).
 */
async function unreadMessageCount(profileId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .neq("sender_id", profileId)
    .is("read_at", null);
  return count ?? 0;
}

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Anyone signed in may look around; paying unlocks taking part. Only a
  // rejected member is turned away here.
  const profile = await requireCommunityAccess();

  // First-login gate: members must complete their profile before entering.
  // (Admins/staff skip — they manage, they don't onboard.)
  if (!profile.profile_completed && profile.role !== "admin") {
    return <ProfileOnboarding profile={profile} />;
  }

  const meta = [profile.specialization, profile.region].filter(Boolean).join(" · ");
  const subscriber = isSubscriber(profile);
  // A free member reads the history she already has, so the count is hers too.
  const unreadCount = await unreadMessageCount(profile.id);

  // She turned auto-renewal off but is still inside the paid period — a quiet
  // standing reminder of the end date, with the way back one click away.
  let cancelNotice: string | null = null;
  if (subscriber && profile.role === "junior") {
    const supabase = await createClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, canceled_at, current_period_end")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (sub?.status === "active" && sub.canceled_at && sub.current_period_end) {
      cancelNotice = new Intl.DateTimeFormat("he-IL", {
        day: "numeric",
        month: "long",
        timeZone: "Asia/Jerusalem",
      }).format(new Date(sub.current_period_end));
    }
  }

  return (
    <AppShell
      user={{
        name: profile.full_name || "חברה",
        meta: meta || "חברת קהילה",
        initials: profile.avatar_initials || profile.full_name.slice(0, 1) || "ק",
        isAdmin: profile.role === "admin",
        isMentor: profile.role === "mentor",
        isSubscriber: subscriber,
        unreadCount,
      }}
    >
      {cancelNotice && (
        <Link
          href="/profile"
          className="flex items-center gap-2.5 bg-tint-warm border border-[#F8D98C] rounded-md p-3 px-4 mb-5 text-[13.5px] text-[#8C5E0E] hover:border-[#E5A93C] transition-colors"
        >
          <span className="flex-1">
            ביטלת את חידוש המנוי — הוא פעיל עד <b>{cancelNotice}</b>. התחרטת? אפשר להפעיל מחדש
            בלחיצה.
          </span>
          <span className="font-display font-semibold whitespace-nowrap">לפרופיל ←</span>
        </Link>
      )}
      {!subscriber && (
        <Link
          href="/join"
          className="flex items-center gap-2.5 bg-brand-gradient-soft border border-[#DDC9EC] rounded-md p-3 px-4 mb-5 text-[13.5px] text-ink-900 hover:border-brand-purple transition-colors"
        >
          <Sparkles size={17} className="text-brand-pink-deep shrink-0" />
          <span className="flex-1">
            את מסתכלת מסביב 👋 עם מנוי נפתחות גם הקלטות הסשנים, הקורסים, כלי ה-AI והשיחות בפורום.
          </span>
          <span className="font-display font-semibold text-brand-purple whitespace-nowrap">
            למנוי ←
          </span>
        </Link>
      )}
      {children}
    </AppShell>
  );
}
