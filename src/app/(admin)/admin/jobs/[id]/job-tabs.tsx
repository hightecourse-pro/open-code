"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface JobTabDef {
  key: string;
  label: string;
  /** Shown as "label (N)" — natural counters like מועמדות (3). */
  count?: number;
}

/**
 * The job page's tab bar. The server page composes every section once and
 * passes it as a named panel — switching tabs is pure client-side state (no
 * navigation), initialized from the ?tab= search param the server passes.
 * Inactive panels stay mounted (hidden) so in-progress client state — a
 * half-built publish audience, an open edit form — survives tab hops.
 */
export function JobTabs({
  tabs,
  initialTab,
  panels,
}: {
  tabs: JobTabDef[];
  initialTab: string;
  panels: Record<string, ReactNode>;
}) {
  const [active, setActive] = useState(
    tabs.some((t) => t.key === initialTab) ? initialTab : (tabs[0]?.key ?? "")
  );

  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="אזורי ניהול המשרה"
        className="flex flex-wrap items-center gap-1.5 bg-white border border-ink-200 rounded-[18px] p-1.5 shadow-sm"
      >
        {tabs.map((t) => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className={cn(
                "rounded-full px-4 py-2 text-[13px] font-semibold transition-colors cursor-pointer",
                on ? "bg-brand-gradient text-white" : "text-ink-700 hover:bg-ink-50"
              )}
            >
              {t.label}
              {typeof t.count === "number" ? ` (${t.count})` : ""}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" hidden={active !== t.key}>
          {panels[t.key]}
        </div>
      ))}
    </div>
  );
}
