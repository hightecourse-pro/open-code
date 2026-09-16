"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, GraduationCap, MessageCircle, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/coordinator", label: "הבוגרות שלי", icon: GraduationCap },
  { href: "/coordinator/jobs", label: "משרות והגשות", icon: Briefcase },
  { href: "/coordinator/hires", label: "גיוסים", icon: PartyPopper },
  { href: "/coordinator/chat", label: "צ'אט עם הצוות", icon: MessageCircle },
];

/** The portal's tab menu; a graduate page highlights הבוגרות שלי. */
export function CoordinatorNav() {
  const pathname = usePathname();
  const activeOf = (href: string) =>
    href === "/coordinator"
      ? pathname === "/coordinator" || pathname.startsWith("/coordinator/member")
      : pathname.startsWith(href);

  return (
    <nav className="flex gap-1 -mb-px overflow-x-auto" role="tablist">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = activeOf(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13.5px] font-semibold border-b-2 whitespace-nowrap transition-colors",
              active
                ? "border-brand-purple text-brand-purple"
                : "border-transparent text-ink-500 hover:text-ink-800"
            )}
          >
            <Icon size={15} /> {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
