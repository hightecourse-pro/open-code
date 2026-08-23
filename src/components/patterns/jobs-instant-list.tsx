"use client";

import { useMemo, useState, type ReactNode } from "react";
import { InstantSearchInput, useInstantFilter, type InstantItem } from "./instant-filter";

export interface JobListItem extends InstantItem {
  /** Facet values for the filter selects — prepared by the server. */
  tech: string[];
  location: string | null;
  employment: string;
}

/**
 * The jobs board: instant text search plus the PM's structured filters —
 * technology, location, employment type. Everything arrives server-rendered
 * (cards, ordering, match badges); this component only shows and hides.
 */
export function JobsInstantList({
  items,
  controls,
  fitOnly,
  emptyFallback,
  initialQuery = "",
  facets,
}: {
  items: JobListItem[];
  /** Server-rendered links that keep their URL state (view pills, tabs). */
  controls?: ReactNode;
  fitOnly: boolean;
  emptyFallback: ReactNode;
  initialQuery?: string;
  facets: { tech: string[]; locations: string[]; employments: { value: string; label: string }[] };
}) {
  const [needle, setNeedle] = useState(initialQuery);
  const [tech, setTech] = useState("");
  const [location, setLocation] = useState("");
  const [employment, setEmployment] = useState("");

  const textFiltered = useInstantFilter(items, needle, (item) => item.haystack);
  const filtered = useMemo(
    () =>
      textFiltered.filter((item) => {
        const it = item as JobListItem;
        if (tech && !it.tech.some((t) => t === tech)) return false;
        if (location && it.location !== location) return false;
        if (employment && it.employment !== employment) return false;
        return true;
      }),
    [textFiltered, tech, location, employment]
  );

  const anyFilter = needle.trim() || tech || location || employment;
  const selectCls =
    "px-2.5 py-1.5 rounded-md border border-ink-200 bg-white text-[12.5px] text-ink-700 outline-none focus:border-brand-purple max-w-40";

  return (
    <>
      {controls}

      <div className="flex flex-wrap items-center gap-2">
        <InstantSearchInput
          value={needle}
          onChange={setNeedle}
          label="חיפוש משרות"
          placeholder="תפקיד, טכנולוגיה או מילה מהתיאור…"
          className="min-w-44"
        />
        <select aria-label="סינון לפי טכנולוגיה" value={tech} onChange={(e) => setTech(e.target.value)} className={selectCls}>
          <option value="">כל טכנולוגיה</option>
          {facets.tech.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {facets.locations.length > 0 && (
          <select aria-label="סינון לפי מיקום" value={location} onChange={(e) => setLocation(e.target.value)} className={selectCls}>
            <option value="">כל מיקום</option>
            {facets.locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
        <select aria-label="סינון לפי היקף" value={employment} onChange={(e) => setEmployment(e.target.value)} className={selectCls}>
          <option value="">כל היקף</option>
          {facets.employments.map((e2) => (
            <option key={e2.value} value={e2.value}>
              {e2.label}
            </option>
          ))}
        </select>
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setNeedle("");
              setTech("");
              setLocation("");
              setEmployment("");
            }}
            className="text-[12.5px] font-semibold text-brand-purple cursor-pointer"
          >
            ניקוי
          </button>
        )}
      </div>

      {anyFilter && (
        <p className="text-[13px] text-ink-700 -mt-1">
          {filtered.length === 1 ? "תוצאה אחת" : `${filtered.length} תוצאות`}
          {needle.trim() ? ` עבור “${needle.trim()}”` : ""}
          {fitOnly ? " — רק משרות שמתאימות לך" : ""}.
        </p>
      )}

      {items.length === 0 ? (
        emptyFallback
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-lg p-5 shadow-sm text-ink-700 text-sm">
          שום משרה לא עונה על הסינון הזה — נסי לשחרר מסנן אחד 💜
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          {filtered.map((item) => (
            <div key={item.id} className="h-full">
              {item.node}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
