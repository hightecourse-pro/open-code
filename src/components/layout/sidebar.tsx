"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  Calendar,
  CreditCard,
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
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui";
import { signOut } from "@/app/(auth)/actions";

/** `paid: true` marks a destination that needs a subscription. */
type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number; paid?: boolean };
type NavSection = { label?: string; items: NavItem[] };

// Order per the PM (2026-08-24): forum, members, jobs, live events, then the
// recordings right under the events they came from; articles close the section.
const SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/forum", label: "פורום הקהילה", icon: MessageSquare },
      { href: "/members", label: "המשתתפות שלנו", icon: Users },
      { href: "/jobs", label: "משרות", icon: Briefcase },
      { href: "/events", label: "אירועים וסשנים LIVE", icon: Calendar },
      { href: "/recordings", label: "הקלטות סשנים", icon: Play, paid: true },
      { href: "/courses", label: "ספריית קורסים", icon: GraduationCap, paid: true },
      { href: "/articles", label: "מאמרים מקצועיים", icon: BookOpen },
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
      { href: "/chat", label: "צ'אטים", icon: MessageCircle, paid: true },
      { href: "/subscription", label: "המנוי שלי", icon: CreditCard },
      { href: "/cv", label: "קורות החיים שלי", icon: FileText },
      { href: "/mentor", label: "המנטוריות שלי", icon: Crown },
    ],
  },
];

export interface SidebarUser {
  name: string;
  meta: string;
  initials: string;
  isAdmin?: boolean;
  /** Mentors contribute, they don't job-hunt or study — jobs + courses hide. */
  isMentor?: boolean;
  /** Free members see paid destinations marked with a lock. */
  isSubscriber?: boolean;
  /** Chat messages waiting for her — shown as a badge on "צ'אטים". */
  unreadCount?: number;
}

/** Destinations that are not part of the mentor experience. Jobs ARE (senior
 * roles get published to mentors per-job); courses open by mentor points. */
const NOT_FOR_MENTORS = new Set(["/courses", "/subscription"]);

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
    <nav className="bg-white border-e border-ink-200 p-3 pt-3 flex flex-col gap-1 sticky top-0 h-screen overflow-y-auto">
      <Link href="/forum" className="px-2 mb-1 block w-fit" aria-label="קוד פתוח">
        <Logo width={112} />
      </Link>

      {SECTIONS.map((section, i) => (
        <div key={section.label ?? i} className="flex flex-col gap-0.5">
          {section.label && (
            <div className="text-[11px] text-ink-500 tracking-[0.06em] uppercase font-semibold px-2 mt-1.5">
              {section.label}
            </div>
          )}
          {section.items
            .filter((item) => !(user.isMentor && NOT_FOR_MENTORS.has(item.href)))
            .map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const locked = item.paid && user.isSubscriber === false;
            // The chat count comes from the server on every render; a static
            // `badge` on the item would be a number nobody updates.
            const unread = item.href === "/chat" ? (user.unreadCount ?? 0) : 0;
            const badge = unread > 0 ? (unread > 9 ? "9+" : String(unread)) : item.badge?.toString();
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={locked ? "נפתח עם מנוי" : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-1 rounded-xl text-[13.5px] font-medium transition-colors",
                  active
                    ? "bg-brand-gradient text-white shadow-glow-pink"
                    : locked
                      ? "text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                      : "text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span>{item.label}</span>
                {(locked || badge) && (
                  <span className="ms-auto flex items-center gap-1.5">
                    {locked && (
                      <Lock size={13} className={cn("shrink-0", active ? "text-white/80" : "text-ink-400")} />
                    )}
                    {badge && (
                      <span
                        aria-label={
                          unread > 0
                            ? unread === 1
                              ? "הודעה אחת שלא נקראה"
                              : `${unread} הודעות שלא נקראו`
                            : undefined
                        }
                        className={cn(
                          "px-2 py-px rounded-full text-[11px] font-bold",
                          active ? "bg-white/25 text-white" : "bg-tint-pink text-brand-pink-deep"
                        )}
                      >
                        {badge}
                      </span>
                    )}
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
          className="mt-auto flex items-center gap-2.5 px-3 py-1 rounded-xl text-[13.5px] font-semibold bg-brand-gradient-soft border border-[#DDC9EC] text-ink-900 hover:border-brand-purple transition-colors"
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
            "mt-auto flex items-center gap-2.5 px-3 py-1 rounded-xl text-[13.5px] font-semibold transition-colors",
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
          "bg-ink-50 border border-ink-200 rounded-md p-2.5 flex items-center gap-2.5",
          !user.isAdmin && user.isSubscriber !== false && "mt-auto"
        )}
      >
        <div className="w-8 h-8 rounded-full bg-brand-gradient text-white text-sm font-bold flex items-center justify-center shrink-0">
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
