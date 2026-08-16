import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout";
import { ProfileOnboarding } from "@/components/patterns/profile-onboarding";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Messages waiting for her — the same rule the daily digest counts by: in one
 * of her conversations, written by the other side, never read. RLS already
 * limits both queries to her own threads, so no service role is needed.
 */
async function unreadMessageCount(profileId: string): Promise<number> {
  const supabase = await createClient();
  const { data: conversations } = await supabase.from("conversations").select("id");
  const ids = (conversations ?? []).map((c) => c.id);
  if (ids.length === 0) return 0;

  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", ids)
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

  return (
    <AppShell
      user={{
        name: profile.full_name || "חברה",
        meta: meta || "חברת קהילה",
        initials: profile.avatar_initials || profile.full_name.slice(0, 1) || "ק",
        isAdmin: profile.role === "admin",
        isSubscriber: subscriber,
        unreadCount,
      }}
    >
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
