"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  ClipboardList,
  CreditCard,
  Building2,
  Calendar,
  ContactRound,
  Crown,
  FileText,
  HeartHandshake,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Library,
  Settings,
  Share2,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AdminNavItem = { href: string; label: string; icon: LucideIcon; badge?: number };
type AdminNavSection = { title: string; items: AdminNavItem[] };

// Shira's grouping (2026-08-28): five titled sections instead of one long list.
const SECTIONS: AdminNavSection[] = [
  {
    title: "קהילה",
    items: [
      { href: "/admin/alerts", label: "התראות", icon: Bell },
      { href: "/admin", label: "דשבורד", icon: LayoutDashboard },
      { href: "/admin/members", label: "חברות", icon: Users },
      { href: "/admin/requests", label: "פניות לצוות", icon: Inbox },
    ],
  },
  {
    title: "ליווי",
    items: [
      { href: "/admin/mentors", label: "מנטוריות", icon: Crown },
      { href: "/admin/mentor-requests", label: "בקשות לליווי", icon: HeartHandshake },
    ],
  },
  {
    title: "השמה",
    items: [
      { href: "/admin/jobs", label: "משרות", icon: Briefcase },
      { href: "/admin/submissions", label: "רשימת הגשות", icon: ClipboardList },
      { href: "/admin/cv-files", label: "קורות חיים", icon: FileText },
      { href: "/admin/crm", label: "פייפליין לקוחות", icon: ContactRound },
      { href: "/admin/clients", label: "גישת לקוחות לפורטל", icon: Building2 },
    ],
  },
  {
    title: "תוכן",
    items: [
      { href: "/admin/content", label: "קורסים", icon: Library },
      { href: "/admin/articles", label: "מאמרים", icon: BookOpen },
      { href: "/admin/sessions", label: "סשנים", icon: Calendar },
      { href: "/admin/shares", label: "הרשאות לתכנים", icon: Share2 },
    ],
  },
  {
    title: "מערכת",
    items: [
      { href: "/admin/analytics", label: "נתוני למידה", icon: BarChart3 },
      { href: "/admin/payments", label: "תשלומים", icon: CreditCard },
      { href: "/admin/config", label: "הגדרות", icon: Settings },
      { href: "/admin/ai-keys", label: "מפתחות AI", icon: KeyRound },
      { href: "/admin/moderation", label: "מודרציה", icon: Shield },
    ],
  },
];

export function AdminSidebar({ alertsBadge = 0, requestsBadge = 0 }: { alertsBadge?: number; requestsBadge?: number }) {
  const pathname = usePathname();

  return (
    <nav className="bg-ink-1000 text-white p-4 pt-[22px] flex flex-col gap-0.5 sticky top-0 h-screen overflow-y-auto">
      <div className="px-2 pb-4 mb-1.5 border-b border-white/10">
        <div className="font-display font-black text-lg">קוד פתוח</div>
        <span className="font-mono text-[11px] opacity-60 block mt-0.5">admin</span>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="mb-1.5">
          <div className="px-3 pt-2 pb-1 text-[10.5px] font-bold tracking-[0.08em] text-white/40 uppercase">
            {section.title}
          </div>
          {section.items.map((item) => {
            // Exact match for the dashboard root; prefix match for subsections.
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const badge =
              item.href === "/admin/alerts" && alertsBadge > 0
                ? alertsBadge
                : item.href === "/admin/requests" && requestsBadge > 0
                  ? requestsBadge
                  : item.badge;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-[7px] rounded-sm text-[13.5px] transition-colors",
                  active
                    ? "bg-brand-gradient text-white"
                    : "text-white/70 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span>{item.label}</span>
                {badge != null && (
                  <span
                    className={cn(
                      "ms-auto px-[7px] rounded-full text-[10.5px] font-bold font-mono",
                      active ? "bg-white/[0.28]" : "bg-white/[0.18]"
                    )}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      <Link
        href="/forum"
        className="mt-auto flex items-center gap-2.5 px-3 py-2 rounded-sm text-[13.5px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
      >
        <ArrowRight size={16} className="shrink-0" />
        <span>חזרה לקהילה</span>
      </Link>
    </nav>
  );
}
