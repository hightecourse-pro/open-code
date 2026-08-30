"use client";

import { useMemo, useState, type ReactNode } from "react";
import { InstantSearchInput, useInstantFilter, type InstantItem } from "./instant-filter";
import { techKey } from "@/lib/tech-match";

export interface JobListItem extends InstantItem {
  /** Facet values for the filter selects — prepared by the server. */
  tech: string[];
  location: string | null;
  /** The job's role bucket (פיתוח / בדיקות / …) — "אחר" when unset. */
  role: string;
}

/**
 * The jobs board: instant text search plus the PM's structured filters —
 * technology, location, employment type. Everything arrives server-rendered
 * (cards, ordering, match badges); this component only shows and hides.
 *
 * The search/filters row sits at the TOP and governs the whole board — the
 * targeted "משרות בשבילך" section included (the owner, 2026-08-30: "הסינון
 * אמור להיות למעלה ולחול על הכל").
 */
export function JobsInstantList({
  items,
  targeted = [],
  targetedHeader,
  controls,
  fitOnly,
  emptyFallback,
  initialQuery = "",
  facets,
}: {
  items: JobListItem[];
  /** Jobs published personally to this member — framed above the main grid. */
  targeted?: JobListItem[];
  /** The frame's heading content (server-rendered). */
  targetedHeader?: ReactNode;
  /** Server-rendered links that keep their URL state (view pills, tabs). */
  controls?: ReactNode;
  fitOnly: boolean;
  emptyFallback: ReactNode;
  initialQuery?: string;
  facets: { techOptions: string[]; locations: string[]; roles: string[] };
}) {
  const [needle, setNeedle] = useState(initialQuery);
  const [tech, setTech] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState("");

  const matchesFacets = (item: InstantItem) => {
    const it = item as JobListItem;
    if (tech) {
      // Contains-match on the canonical key: "נוד" or "node" finds Node.js.
      const k = techKey(tech);
      if (!k || !it.tech.some((t) => techKey(t).includes(k))) return false;
    }
    if (location && it.location !== location) return false;
    if (role && it.role !== role) return false;
    return true;
  };

  const textFiltered = useInstantFilter(items, needle, (item) => item.haystack);
  const filtered = useMemo(
    () => textFiltered.filter(matchesFacets),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textFiltered, tech, location, role]
  );
  const targetedTextFiltered = useInstantFilter(targeted, needle, (item) => item.haystack);
  const filteredTargeted = useMemo(
    () => targetedTextFiltered.filter(matchesFacets),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [targetedTextFiltered, tech, location, role]
  );

  const anyFilter = needle.trim() || tech || location || role;
  const totalShown = filtered.length + filteredTargeted.length;
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
        {/* Type-ahead over the FULL technology list — contains-matching, so
            typing part of a name offers it (the owner, 30/8). */}
        <input
          list="job-tech-options"
          aria-label="סינון לפי טכנולוגיה"
          value={tech}
          onChange={(e) => setTech(e.target.value)}
          placeholder="טכנולוגיה…"
          className="px-2.5 py-1.5 rounded-md border border-ink-200 bg-white text-[12.5px] text-ink-700 outline-none focus:border-brand-purple max-w-36"
        />
        <datalist id="job-tech-options">
          {facets.techOptions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
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
        <select aria-label="סינון לפי תפקיד" value={role} onChange={(e) => setRole(e.target.value)} className={selectCls}>
          <option value="">כל תפקיד</option>
          {facets.roles.map((r) => (
            <option key={r} value={r}>
              {r}
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
              setRole("");
            }}
            className="text-[12.5px] font-semibold text-brand-purple cursor-pointer"
          >
            ניקוי
          </button>
        )}
      </div>

      {anyFilter && (
        <p className="text-[13px] text-ink-700 -mt-1">
          {totalShown === 1 ? "תוצאה אחת" : `${totalShown} תוצאות`}
          {needle.trim() ? ` עבור “${needle.trim()}”` : ""}
          {fitOnly ? " — רק משרות שמתאימות לך" : ""}.
        </p>
      )}

      {filteredTargeted.length > 0 && (
        <section className="rounded-[18px] p-[2px] bg-brand-gradient shadow-glow-pink">
          <div className="rounded-[16px] bg-white p-3.5 flex flex-col gap-1">
            {targetedHeader}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {filteredTargeted.map((item) => (
                <div key={item.id} className="h-full">
                  {item.node}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {items.length === 0 && targeted.length === 0 ? (
        emptyFallback
      ) : totalShown === 0 ? (
        <div className="bg-white border border-ink-200 rounded-lg p-5 shadow-sm text-ink-700 text-sm">
          שום משרה לא עונה על הסינון הזה — נסי לשחרר מסנן אחד 💜
        </div>
      ) : (
        filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {filtered.map((item) => (
              <div key={item.id} className="h-full">
                {item.node}
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
