"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  Calendar,
  Crown,
  FileCheck2,
  FileText,
  GraduationCap,
  KeyRound,
  Lock,
  LogOut,
  MessageCircle,
  MessageSquare,
  Mic,
  Play,
  Shield,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui";
import { signOut } from "@/app/(auth)/actions";

/** `paid: true` marks a destination that needs a subscription. */
type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number; paid?: boolean };
type NavSection = { label?: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/forum", label: "פורום הקהילה", icon: MessageSquare },
      { href: "/articles", label: "מאמרים מקצועיים", icon: BookOpen },
      { href: "/events", label: "אירועים ומיטאפים", icon: Calendar },
      { href: "/jobs", label: "משרות", icon: Briefcase },
      { href: "/courses", label: "ספריית קורסים", icon: GraduationCap, paid: true },
      { href: "/recordings", label: "הקלטות סשנים", icon: Play, paid: true },
    ],
  },
  {
    label: "כלי AI",
    items: [
      { href: "/ai/cv-checker", label: "בודקת קורות חיים", icon: FileCheck2, paid: true },
      { href: "/ai/interview", label: "סימולטור ראיונות", icon: Mic, paid: true },
      { href: "/ai/keys", label: "מפתחות API שלי", icon: KeyRound, paid: true },
    ],
  },
  {
    label: "אישי",
    items: [
      { href: "/profile", label: "הפרופיל שלי", icon: User },
      { href: "/cv", label: "קורות החיים שלי", icon: FileText },
      { href: "/mentor", label: "המנטוריות שלנו", icon: Crown },
      { href: "/chat", label: "צ'אטים", icon: MessageCircle, paid: true },
    ],
  },
];

export interface SidebarUser {
  name: string;
  meta: string;
  initials: string;
  isAdmin?: boolean;
  /** Free members see paid destinations marked with a lock. */
  isSubscriber?: boolean;
}

const DEFAULT_USER: SidebarUser = {
  name: "מאיה כהן",
  meta: "פרונטאנד · מרכז",
  initials: "מ",
  isAdmin: false,
  isSubscriber: true,
};

export function Sidebar({ user = DEFAULT_USER }: { user?: SidebarUser }) {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-e border-ink-200 p-[18px] pt-[22px] flex flex-col gap-1.5 sticky top-0 h-screen overflow-y-auto">
      <Link href="/forum" className="px-2 mb-2.5 block w-fit" aria-label="קוד פתוח">
        <Logo width={140} />
      </Link>

      {SECTIONS.map((section, i) => (
        <div key={section.label ?? i} className="flex flex-col gap-1.5">
          {section.label && (
            <div className="text-[11px] text-ink-500 tracking-[0.06em] uppercase font-semibold px-2 mt-3 mb-0.5">
              {section.label}
            </div>
          )}
          {section.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const locked = item.paid && user.isSubscriber === false;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={locked ? "נפתח עם מנוי" : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[14.5px] font-medium transition-colors",
                  active
                    ? "bg-brand-gradient text-white shadow-glow-pink"
                    : locked
                      ? "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                      : "text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                )}
              >
                <Icon size={18} className="shrink-0" />
                <span>{item.label}</span>
                {locked && (
                  <Lock size={13} className={cn("ms-auto shrink-0", active ? "text-white/80" : "text-ink-400")} />
                )}
                {item.badge != null && (
                  <span
                    className={cn(
                      "ms-auto px-2 py-px rounded-full text-[11px] font-bold",
                      active ? "bg-white/25 text-white" : "bg-tint-pink text-brand-pink-deep"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}

      {user.isSubscriber === false && (
        <Link
          href="/join"
          className="mt-auto flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[14px] font-semibold bg-brand-gradient-soft border border-[#DDC9EC] text-ink-900 hover:border-brand-purple transition-colors"
        >
          <Sparkles size={17} className="shrink-0 text-brand-pink-deep" />
          <span>שדרוג למנוי מלא</span>
        </Link>
      )}

      {user.isAdmin && (
        <Link
          href="/admin"
          aria-current={pathname.startsWith("/admin") ? "page" : undefined}
          className={cn(
            "mt-auto flex items-center gap-2.5 px-3 py-[9px] rounded-xl text-[14.5px] font-semibold transition-colors",
            pathname.startsWith("/admin")
              ? "bg-ink-1000 text-white"
              : "bg-ink-100 text-ink-900 hover:bg-ink-200"
          )}
        >
          <Shield size={18} className="shrink-0" />
          <span>ניהול הקהילה</span>
        </Link>
      )}

      <div
        className={cn(
          "bg-ink-50 border border-ink-200 rounded-md p-3 flex items-center gap-2.5",
          !user.isAdmin && user.isSubscriber !== false && "mt-auto"
        )}
      >
        <div className="w-9 h-9 rounded-full bg-brand-gradient text-white font-bold flex items-center justify-center shrink-0">
          {user.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-sm truncate">{user.name}</div>
          <div className="text-xs text-ink-500 truncate">{user.meta}</div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="יציאה"
            className="text-ink-400 hover:text-brand-pink-deep hover:bg-ink-100 rounded-sm p-1.5 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </nav>
  );
}
