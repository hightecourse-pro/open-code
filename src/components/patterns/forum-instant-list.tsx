"use client";

import { Fragment, useState, type ReactNode } from "react";
import { InstantSearchInput, useInstantFilter, type InstantItem } from "./instant-filter";

/** "נמצאו 7 נושאים" while searching, plain "7 נושאים" while browsing. */
function countLabel(count: number, searching: boolean): string {
  if (count === 0) return searching ? "לא נמצאו נושאים" : "אין עדיין נושאים";
  if (count === 1) return searching ? "נמצא נושא אחד" : "נושא אחד";
  return `${searching ? "נמצאו " : ""}${count} נושאים`;
}

/**
 * The topic list with instant search: rows arrive server-rendered and typing
 * filters them in place — no navigation, no URL writes. It searches over the
 * topics that are loaded (the page caps them at 50 newest), not the archive.
 */
export function ForumInstantList({
  items,
  chips,
  savedOnly,
  canWrite,
  initialQuery = "",
}: {
  items: InstantItem[];
  /** The "כל הנושאים / ששמרתי" chips — server-rendered links. */
  chips?: ReactNode;
  savedOnly: boolean;
  /** Free members get no search card — only the (gated) list below. */
  canWrite: boolean;
  initialQuery?: string;
}) {
  const [needle, setNeedle] = useState(initialQuery);
  const filtered = useInstantFilter(items, needle, (item) => item.haystack);
  const searching = needle.trim().length > 0;

  return (
    <>
      {canWrite && (
        <div className="bg-white border border-ink-200 rounded-[18px] p-4 shadow-sm flex flex-col gap-2.5">
          <InstantSearchInput
            value={needle}
            onChange={setNeedle}
            label="חיפוש נושא בפורום"
            placeholder="חיפוש לפי מילה בנושא או בתוכן…"
          />
          {chips}
          <div className="flex items-center gap-3 flex-wrap text-[12.5px] text-ink-500">
            <span>{countLabel(filtered.length, searching)}</span>
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
      )}

      {filtered.length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          {searching
            ? "לא מצאנו נושא שמתאים לחיפוש — אולי לנסות מילה אחרת? 💜"
            : savedOnly
              ? "עוד לא שמרת נושאים. בכל שיחה יש כפתור שמירה 🔖 — מה שתשמרי יחכה לך כאן 💜"
              : canWrite
                ? "הפורום שקט עכשיו — אולי דווקא את תפתחי את השיחה הראשונה?"
                : "השיחות של הקהילה מחכות כאן מאחורי המנוי — נשמח לפתוח לך אותן 💜"}
        </div>
      ) : (
        <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm overflow-hidden divide-y divide-ink-100">
          <div className="flex items-center px-4 py-2.5 text-[11.5px] font-bold text-ink-400 uppercase tracking-wide bg-ink-50/60">
            <span className="flex-1">נושא</span>
            <span className="w-20 text-center">תגובות</span>
            <span className="hidden md:block w-16 text-end">פעילות</span>
          </div>
          {filtered.map((item) => (
            <Fragment key={item.id}>{item.node}</Fragment>
          ))}
        </div>
      )}
    </>
  );
}
