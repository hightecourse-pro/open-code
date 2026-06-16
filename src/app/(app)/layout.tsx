import { AppShell } from "@/components/layout";
import { requireActiveAccess } from "@/lib/auth";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate: signed in + active. Redirects to /login or /join otherwise.
  const profile = await requireActiveAccess();

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
