"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Briefcase, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/portal", label: "חיפוש מועמדות", icon: Search },
  { href: "/portal/jobs", label: "המשרות שלי", icon: Briefcase },
  { href: "/portal/favorites", label: "המועדפות שלי", icon: Star },
];

/** The portal's top-bar sections. Dark-surface styling to sit on the ink bar. */
export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {ITEMS.map((item) => {
        const active =
          item.href === "/portal" ? pathname === "/portal" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[13px] font-semibold transition-colors",
              active ? "bg-white/10 text-ink-0" : "text-white/60 hover:text-ink-0 hover:bg-white/[0.06]"
            )}
          >
            <Icon size={15} className="shrink-0" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
