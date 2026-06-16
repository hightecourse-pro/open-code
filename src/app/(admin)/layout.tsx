import { AdminShell } from "@/components/layout";
import { requireRole } from "@/lib/auth";

export default async function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate: admin role only. Non-admins are redirected to the feed.
  await requireRole("admin");
  return <AdminShell>{children}</AdminShell>;
}
