import * as React from "react";
import { AdminSidebar } from "./admin-sidebar";

/** Admin layout: dark 240px sidebar on the right + main content. */
export function AdminShell({
  children,
  alertsBadge = 0,
  requestsBadge = 0,
}: {
  children: React.ReactNode;
  alertsBadge?: number;
  requestsBadge?: number;
}) {
  return (
    <div className="min-h-screen bg-ink-50 grid grid-cols-1 lg:grid-cols-[240px_1fr]">
      <div className="hidden lg:block">
        <AdminSidebar alertsBadge={alertsBadge} requestsBadge={requestsBadge} />
      </div>
      <main className="px-6 py-7 md:px-8">{children}</main>
    </div>
  );
}
