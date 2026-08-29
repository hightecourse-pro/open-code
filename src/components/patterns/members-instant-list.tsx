"use client";

import { Fragment, useState } from "react";
import { InstantSearchInput, useInstantFilter, type InstantItem } from "./instant-filter";

/** "נמצאו 12 משתתפות" while searching, plain "12 משתתפות" while browsing. */
function countLabel(count: number, searching: boolean): string {
  if (count === 0) return searching ? "לא נמצאו משתתפות" : "אין עדיין משתתפות";
  if (count === 1) return searching ? "נמצאה משתתפת אחת" : "משתתפת אחת";
  return `${searching ? "נמצאו " : ""}${count} משתתפות`;
}

/**
 * The directory with instant search: cards arrive server-rendered, and typing
 * filters them in place — by name, specialization or region — with no
 * navigation and no URL writes.
 */
export function MembersInstantList({
  items,
  capped,
  initialQuery = "",
}: {
  items: InstantItem[];
  /** The browse list hit MAX_RESULTS — noted next to the count. */
  capped: boolean;
  initialQuery?: string;
}) {
  const [needle, setNeedle] = useState(initialQuery);
  const filtered = useInstantFilter(items, needle, (item) => item.haystack);
  const searching = needle.trim().length > 0;

  return (
    <>
      <div className="bg-white border border-ink-200 rounded-[18px] p-4 shadow-sm flex flex-col gap-2.5">
        <InstantSearchInput
          value={needle}
          onChange={setNeedle}
          label="חיפוש משתתפת"
          placeholder="חיפוש לפי שם, תחום או אזור…"
        />
        <div className="flex items-center gap-3 flex-wrap text-[12.5px] text-ink-500">
          <span>
            {countLabel(filtered.length, searching)}
            {capped && !searching && " ראשונות — החיפוש יביא אותך ישר למי שאת מחפשת"}
          </span>
          {searching && (
            <button
              type="button"
              onClick={() => setNeedle("")}
              className="font-semibold text-brand-purple hover:underline cursor-pointer"
            >
              ניקוי החיפוש
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700 flex flex-col gap-2">
          {searching
            ? "לא מצאנו משתתפת שמתאימה לחיפוש בין המשתתפות שנטענו 💜"
            : "רשימת המשתתפות עוד מתמלאת — בקרוב תמצאי כאן את כל מי שאיתנו 💜"}
          {searching && capped && (
            // The instant filter only sees the loaded page; the whole
            // community is one server search away.
            <a
              href={`/members?q=${encodeURIComponent(needle.trim())}`}
              className="font-semibold text-brand-purple hover:underline w-fit"
            >
              חיפוש בכל הקהילה ←
            </a>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <Fragment key={item.id}>{item.node}</Fragment>
          ))}
        </div>
      )}
    </>
  );
}
