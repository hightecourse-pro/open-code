import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout";
import { ProfileOnboarding } from "@/components/patterns/profile-onboarding";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";

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

  return (
    <AppShell
      user={{
        name: profile.full_name || "חברה",
        meta: meta || "חברת קהילה",
        initials: profile.avatar_initials || profile.full_name.slice(0, 1) || "ק",
        isAdmin: profile.role === "admin",
        isSubscriber: subscriber,
      }}
    >
      {!subscriber && (
        <Link
          href="/join"
          className="flex items-center gap-2.5 bg-brand-gradient-soft border border-[#DDC9EC] rounded-md p-3 px-4 mb-5 text-[13.5px] text-ink-900 hover:border-brand-purple transition-colors"
        >
          <Sparkles size={17} className="text-brand-pink-deep shrink-0" />
          <span className="flex-1">
            את מסתכלת מסביב 👋 עם מנוי נפתחות גם הקלטות הסשנים, הקורסים, כלי ה-AI וכתיבה בפורום.
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
