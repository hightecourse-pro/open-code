import { AdminShell } from "@/components/layout";
import { requireRole } from "@/lib/auth";
import { openRequestCount, unreadAlertCount } from "@/lib/alerts";
import { waAwaitingReplyCount } from "@/lib/whatsapp-inbox";

export default async function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate: admin role only. Non-admins are redirected to the feed.
  await requireRole("admin");
  // One head-only count - the sidebar bell. Every admin page pays it, which
  // is the point: an unread critical alert should be visible from anywhere.
  const [alertsBadge, requestsBadge, whatsappBadge] = await Promise.all([unreadAlertCount(), openRequestCount(), waAwaitingReplyCount()]);
  return <AdminShell alertsBadge={alertsBadge} requestsBadge={requestsBadge} whatsappBadge={whatsappBadge}>{children}</AdminShell>;
}
