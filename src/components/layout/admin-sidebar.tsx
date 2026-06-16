"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Calendar,
  Crown,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AdminNavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

const ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "דשבורד", icon: LayoutDashboard },
  { href: "/admin/members", label: "חברות", icon: Users, badge: 8 },
  { href: "/admin/mentors", label: "מנטוריות", icon: Crown },
  { href: "/admin/jobs", label: "משרות", icon: Briefcase },
  { href: "/admin/sessions", label: "סשנים", icon: Calendar },
  { href: "/admin/analytics", label: "אנליטיקת למידה", icon: BarChart3 },
  { href: "/admin/config", label: "קונפיגורציה", icon: Settings },
  { href: "/admin/moderation", label: "מודרציה", icon: Shield },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="bg-ink-1000 text-white p-4 pt-[22px] flex flex-col gap-1.5 sticky top-0 h-screen overflow-y-auto">
      <div className="px-2 pb-4 mb-2 border-b border-white/10">
        <div className="font-display font-black text-lg">קוד פתוח</div>
        <span className="font-mono text-[11px] opacity-60 block mt-0.5">admin</span>
      </div>

      {ITEMS.map((item) => {
        // Exact match for the dashboard root; prefix match for subsections.
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-sm text-[13.5px] transition-colors",
              active
                ? "bg-brand-gradient text-white"
                : "text-white/70 hover:bg-white/[0.06] hover:text-white"
            )}
          >
            <Icon size={16} className="shrink-0" />
            <span>{item.label}</span>
            {item.badge != null && (
              <span
                className={cn(
                  "ms-auto px-[7px] rounded-full text-[10.5px] font-bold font-mono",
                  active ? "bg-white/[0.28]" : "bg-white/[0.18]"
                )}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}

      <Link
        href="/feed"
        className="mt-auto flex items-center gap-2.5 px-3 py-2 rounded-sm text-[13.5px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
      >
        <ArrowRight size={16} className="shrink-0" />
        <span>חזרה לקהילה</span>
      </Link>
    </nav>
  );
}
