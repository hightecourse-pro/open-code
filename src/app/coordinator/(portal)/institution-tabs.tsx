"use client";

import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { switchInstitution } from "../actions";

/**
 * Seminary tabs for a multi-seminary coordinator (the owner, 16/9) - each
 * seminary is a fully separate view; switching keeps the current page.
 */
export function InstitutionTabs({
  institutions,
  active,
}: {
  institutions: { value: string; label: string }[];
  active: string;
}) {
  const pathname = usePathname();
  const [pending, start] = useTransition();

  return (
    <div
      role="tablist"
      aria-label="בחירת סמינר"
      className="flex items-center gap-1.5 overflow-x-auto py-2"
    >
      {institutions.map((i) => {
        const on = i.value === active;
        return (
          <button
            key={i.value}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={pending}
            onClick={() => {
              if (!on) start(() => switchInstitution(i.value, pathname));
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-bold whitespace-nowrap border transition-colors cursor-pointer disabled:opacity-60",
              on
                ? "bg-brand-gradient text-white border-transparent shadow-sm"
                : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
            )}
          >
            🎓 {i.label}
          </button>
        );
      })}
    </div>
  );
}
