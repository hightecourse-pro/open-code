"use client";

import { Fragment, useState, type ReactNode } from "react";
import { InstantSearchInput, useInstantFilter, type InstantItem } from "./instant-filter";

/**
 * The jobs board with the owner's instant search: the whole board arrives
 * server-rendered (cards, match badges, canonical ordering — none of that
 * logic lives here), and typing only shows or hides cards. Nothing navigates,
 * the URL never changes.
 */
export function JobsInstantList({
  items,
  controls,
  fitOnly,
  emptyFallback,
  initialQuery = "",
}: {
  items: InstantItem[];
  /** Fit chip + tabs — server-rendered links that keep their URL state. */
  controls?: ReactNode;
  fitOnly: boolean;
  /** Shown when the board itself is empty (nothing typed). */
  emptyFallback: ReactNode;
  initialQuery?: string;
}) {
  const [needle, setNeedle] = useState(initialQuery);
  const filtered = useInstantFilter(items, needle, (item) => item.haystack);
  const shown = needle.trim();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <InstantSearchInput
          value={needle}
          onChange={setNeedle}
          label="חיפוש משרות"
          placeholder="חיפוש לפי תפקיד, טכנולוגיה או מילה מהתיאור…"
          className="min-w-48"
        />
        {shown && (
          <button
            type="button"
            onClick={() => setNeedle("")}
            className="text-[13px] font-semibold text-brand-purple cursor-pointer"
          >
            ניקוי
          </button>
        )}
      </div>

      {controls}

      {(shown || fitOnly) && filtered.length > 0 && (
        <p className="text-[13px] text-ink-700">
          {filtered.length === 1 ? "תוצאה אחת" : `${filtered.length} תוצאות`}
          {shown ? ` עבור “${shown}”` : ""}
          {fitOnly ? " — רק משרות עם הטכנולוגיות שלך" : ""}.
        </p>
      )}

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <Fragment key={item.id}>{item.node}</Fragment>
          ))}
        </div>
      ) : shown ? (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          לא מצאנו משרות שמתאימות ל“{shown}” — אפשר לנסות מילה אחרת או{" "}
          <button
            type="button"
            onClick={() => setNeedle("")}
            className="text-brand-purple font-semibold cursor-pointer"
          >
            לנקות את החיפוש
          </button>{" "}
          💜
        </div>
      ) : (
        emptyFallback
      )}
    </>
  );
}
