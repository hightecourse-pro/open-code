import { AppShell } from "@/components/layout";
import { ProfileOnboarding } from "@/components/patterns/profile-onboarding";
import { requireActiveAccess } from "@/lib/auth";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate: signed in + active. Redirects to /login or /join otherwise.
  const profile = await requireActiveAccess();

  // First-login gate: members must complete their profile before entering.
  // (Admins/staff skip — they manage, they don't onboard.)
  if (!profile.profile_completed && profile.role !== "admin") {
    return <ProfileOnboarding profile={profile} />;
  }

  const meta = [profile.specialization, profile.region].filter(Boolean).join(" · ");

  return (
    <AppShell
      user={{
        name: profile.full_name || "חברה",
        meta: meta || "חברת קהילה",
        initials: profile.avatar_initials || profile.full_name.slice(0, 1) || "ק",
        isAdmin: profile.role === "admin",
      }}
    >
      {children}
    </AppShell>
  );
}
