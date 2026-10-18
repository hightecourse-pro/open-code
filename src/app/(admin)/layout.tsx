import { AdminShell } from "@/components/layout";
import { requireRole } from "@/lib/auth";
import { openRequestCount, unreadAlertCount } from "@/lib/alerts";
import { waUnreadContactsCount } from "@/lib/whatsapp-inbox";
import { PresenceHeartbeat } from "@/components/patterns/presence-heartbeat";
import { ViewerMarker } from "@/components/patterns/stale-while-revalidate";

export default async function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate: admin role only. Non-admins are redirected to the feed.
  const viewer = await requireRole("admin");
  // One head-only count - the sidebar bell. Every admin page pays it, which
  // is the point: an unread critical alert should be visible from anywhere.
  // The WhatsApp badge is per team member: people who wrote and whom SHE has
  // not looked at yet (the owner, 11/10).
  const [alertsBadge, requestsBadge, whatsappBadge] = await Promise.all([unreadAlertCount(), openRequestCount(), waUnreadContactsCount(viewer.id)]);
  return (
    <AdminShell alertsBadge={alertsBadge} requestsBadge={requestsBadge} whatsappBadge={whatsappBadge}>
      <ViewerMarker id={viewer.id} />
      <PresenceHeartbeat />
      {children}
    </AdminShell>
  );
}
