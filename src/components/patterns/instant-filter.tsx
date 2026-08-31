"use client";

import { useDeferredValue, useMemo, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One row of an instantly-filterable list: the server renders the node once
 * (card, topic row…) and pre-joins the text it should be findable by — the
 * client only decides which rows show as she types.
 */
export interface InstantItem {
  id: string;
  /** Pre-joined searchable text for this row, built server-side. */
  haystack: string;
  /** The server-rendered row itself, shown or hidden by the filter. */
  node: ReactNode;
  /** Optional one-click filter group (the directory chips: team/mentor/subscriber). */
  group?: string;
}

/**
 * Instant, client-side filtering: the list narrows as she types — no submit
 * button, no navigation, no URL writes. useDeferredValue keeps the input
 * responsive while a longer list re-filters a beat behind her keystrokes.
 */
export function useInstantFilter<T>(
  items: T[],
  needle: string,
  accessor: (item: T) => string
): T[] {
  const deferred = useDeferredValue(needle.trim().toLowerCase());
  return useMemo(() => {
    if (!deferred) return items;
    return items.filter((item) => accessor(item).toLowerCase().includes(deferred));
  }, [items, deferred, accessor]);
}

/**
 * The community's search box (icon + input), minus the form around it — this
 * one filters in place. Plain controlled input: typing never navigates.
 */
export function InstantSearchInput({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** aria-label — the design shows no separate label element. */
  label: string;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative flex-1", className)}>
      <Search
        size={15}
        aria-hidden
        className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        aria-label={label}
        placeholder={placeholder}
        className="w-full text-sm bg-white border border-ink-300 rounded-md ps-9 pe-3 py-2.5 outline-none focus:border-brand-purple"
      />
    </div>
  );
}
