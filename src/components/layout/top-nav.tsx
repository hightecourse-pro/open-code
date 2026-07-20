"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui";

export interface TopNavItem {
  href: string;
  label: string;
}

export interface TopNavProps {
  items: TopNavItem[];
  /** Avatar initial for the current user. */
  initials?: string;
  /** Label for the primary CTA on the left. */
  ctaLabel?: string;
  ctaHref?: string;
}

/** Horizontal app nav — 64px bar, gradient-text logo, active underline. */
export function TopNav({ items, initials = "מ", ctaLabel = "פוסט חדש", ctaHref = "#" }: TopNavProps) {
  const pathname = usePathname();

  return (
    <header className="h-(--topbar-h) bg-white border-b border-ink-200 px-6 flex items-center gap-6 sticky top-0 z-20">
      <Link href="/" aria-label="קוד פתוח">
        <Logo width={116} />
      </Link>

      <nav className="flex gap-[22px] flex-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative text-sm font-medium py-[22px] transition-colors hover:text-ink-900",
                active ? "text-brand-pink-deep" : "text-ink-700"
              )}
            >
              {item.label}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-gradient" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex gap-2.5 items-center">
        <button
          type="button"
          aria-label="התראות"
          className="text-ink-700 hover:bg-ink-100 rounded-sm p-2 transition-colors"
        >
          <Bell size={18} />
        </button>
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-1.5 bg-brand-gradient text-white font-display font-semibold text-[13px] rounded-sm px-3.5 py-2 shadow-glow-pink"
        >
          <Plus size={15} />
          {ctaLabel}
        </Link>
        <div className="w-9 h-9 rounded-full bg-brand-gradient text-white font-bold text-sm flex items-center justify-center">
          {initials}
        </div>
      </div>
    </header>
  );
}
