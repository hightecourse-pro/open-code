import * as React from "react";
import { cn } from "@/lib/utils";
import { Sidebar, type SidebarUser } from "./sidebar";

export interface AppShellProps {
  children: React.ReactNode;
  /** Optional right-rail content (renders as a third column on wide screens). */
  rail?: React.ReactNode;
  user?: SidebarUser;
}

/**
 * Authenticated community-app layout: right sidebar + main, with an optional
 * left rail. Columns are RTL so the sidebar sits on the right automatically.
 */
export function AppShell({ children, rail, user }: AppShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-ink-50 grid",
        rail
          ? "grid-cols-1 lg:grid-cols-[var(--sidebar-w)_1fr] xl:grid-cols-[var(--sidebar-w)_1fr_340px]"
          : "grid-cols-1 lg:grid-cols-[var(--sidebar-w)_1fr]"
      )}
    >
      <div className="hidden lg:block">
        <Sidebar user={user} />
      </div>

      <main className="px-6 py-7 md:px-8 w-full max-w-[780px] mx-auto">{children}</main>

      {rail && (
        <aside className="hidden xl:flex flex-col gap-[18px] px-[22px] py-7 sticky top-0 self-start">
          {rail}
        </aside>
      )}
    </div>
  );
}
