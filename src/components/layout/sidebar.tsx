"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Trophy,
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
  Rocket,
  Shield,
  Gavel,
  Sparkles,
  Swords,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HACKATHON_UPDATED } from "@/app/hackathon-2026/version";
import { ANNUAL_COURSE_UPDATED } from "@/app/masters-course/version";
import { ARENA_UPDATED } from "@/lib/arena-shared";
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
      { href: "/hackathon", label: "האקתון", icon: Trophy },
      { href: "/arena", label: "זירת המנטוריות", icon: Swords },
      { href: "/judge", label: "שיפוט ההאקתון", icon: Gavel },
      { href: "/annual-course", label: "קורס שנתי ממומן", icon: Rocket },
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

/** Destinations that carry a versioned "חדש" pill: the localStorage key that
 * remembers the version she has seen, and the current version. */
const NEW_ITEMS: Record<string, { key: string; version: string }> = {
  "/hackathon": { key: "oc-hackathon-seen", version: HACKATHON_UPDATED },
  "/annual-course": { key: "oc-annual-course-seen", version: ANNUAL_COURSE_UPDATED },
  "/arena": { key: "oc-arena-seen", version: ARENA_UPDATED },
};

export interface SidebarUser {
  name: string;
  meta: string;
  initials: string;
  isAdmin?: boolean;
  /** Mentors contribute, they don't job-hunt or study - jobs + courses hide. */
  isMentor?: boolean;
  /** Free members see paid destinations marked with a lock. */
  isSubscriber?: boolean;
  /** Chat messages waiting for her - shown as a badge on "צ'אטים". */
  unreadCount?: number;
  /** Threads whose last word is the other side's - shown when nothing is unread (22/10). */
  unansweredCount?: number;
  /** May enter זירת המנטוריות (hackathon registrant, mentor, team). */
  arena?: boolean;
  /** Open arena questions - the badge mentors see. */
  arenaOpen?: number;
  /** Appointed hackathon judge (or the team) - sees ״שיפוט ההאקתון״. */
  judge?: boolean;
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

  // "חדש" on the hackathon item until her first visit (the owner, 7/9), and
  // on the annual course (12/10) - remembered per browser; entering the page
  // clears it for good. Versioned (the owner, 5/10): every update of the
  // destination brings the pill back until she has seen the new version.
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // Deferred a tick - the set-state-in-effect rule (same treatment as the
    // error boundary's healing flag).
    const t = setTimeout(() => {
      try {
        const next: Record<string, boolean> = {};
        for (const [href, { key, version }] of Object.entries(NEW_ITEMS)) {
          if (pathname === href || pathname.startsWith(href + "/")) {
            localStorage.setItem(key, version);
            next[href] = true;
          } else {
            next[href] = localStorage.getItem(key) === version;
          }
        }
        setSeen(next);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

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
            .filter((item) => item.href !== "/arena" || user.arena)
            .filter((item) => item.href !== "/judge" || user.judge)
            .map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const locked = item.paid && user.isSubscriber === false;
            // The chat count comes from the server on every render; a static
            // `badge` on the item would be a number nobody updates.
            const unread = item.href === "/chat" ? (user.unreadCount ?? 0) : item.href === "/arena" ? (user.arenaOpen ?? 0) : 0;
            // Nothing unread but threads still waiting for her reply: the chat
            // item says so (the owner, 22/10: "אין אינדיקציה בתפריט").
            const waiting = item.href === "/chat" && unread === 0 ? (user.unansweredCount ?? 0) : 0;
            const label =
              item.href === "/mentor" && user.isMentor ? "הליוויים שלי" : item.label;
            const badge = unread > 0 ? (unread > 9 ? "9+" : String(unread)) : waiting > 0 ? (waiting > 9 ? "9+" : String(waiting)) : item.badge?.toString();
            // `false` only once the browser has answered - no pill flashes
            // before hydration.
            const isNew = seen[item.href] === false;
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
                <span>{label}</span>
                {(locked || badge || isNew) && (
                  <span className="ms-auto flex items-center gap-1.5">
                    {isNew && (
                      <span
                        className={cn(
                          "px-2 py-px rounded-full text-[10.5px] font-bold",
                          active ? "bg-white/25 text-white" : "bg-brand-gradient text-white"
                        )}
                      >
                        חדש
                      </span>
                    )}
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
                            : waiting > 0
                              ? waiting === 1
                                ? "שיחה אחת ממתינה למענה שלך"
                                : `${waiting} שיחות ממתינות למענה שלך`
                              : undefined
                        }
                        title={waiting > 0 ? (waiting === 1 ? "שיחה אחת ממתינה למענה שלך" : `${waiting} שיחות ממתינות למענה שלך`) : undefined}
                        data-testid={item.href === "/chat" ? "chat-badge" : undefined}
                        data-badge={unread > 0 ? "unread" : waiting > 0 ? "waiting" : undefined}
                        className={cn(
                          "px-2 py-px rounded-full text-[11px] font-bold",
                          active
                            ? "bg-white/25 text-white"
                            : waiting > 0 && unread === 0
                              ? "bg-transparent text-brand-pink-deep border border-brand-pink-deep/40"
                              : "bg-tint-pink text-brand-pink-deep"
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

      {user.isSubscriber === false && !user.isMentor && (
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
