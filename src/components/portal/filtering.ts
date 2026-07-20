// Client-safe mirror of `searchableText` / `applyFilters` from
// "@/lib/portal/candidates".
//
// WHY THIS COPY EXISTS: those two helpers are pure, but they live in a module
// that also reaches loadCandidates() → getTaxonomyOptions() → supabase/server →
// next/headers. Importing anything from that module into a Client Component
// pulls next/headers into the client graph and fails the build, so the filter
// UI cannot import them directly. The candidate list is already serialized to
// the browser, and filtering has to feel instant, so the logic runs here.
//
// The type import below is erased at compile time, so it adds no runtime edge.
//
// KEEP IN SYNC with lib/portal/candidates.ts. The better long-term fix is to
// move these two functions into this module and have candidates.ts re-export
// them, so there is exactly one implementation — that requires touching
// candidates.ts, which is outside this task's area.

import type { CandidateDetail } from "@/lib/portal/candidates";

/** Everything a candidate matched on, flattened for plain-text searching. */
export function searchableText(c: CandidateDetail): string {
  return [
    c.name,
    c.specialization ?? "",
    c.region ?? "",
    c.bio ?? "",
    ...c.fields.flatMap((f) => [f.label, ...f.values]),
  ]
    .join(" ")
    .toLowerCase();
}

/** Structured filter: every selected value must appear somewhere on her profile. */
export function applyFilters(
  candidates: CandidateDetail[],
  filters: Record<string, string[]>,
  freeText: string
): CandidateDetail[] {
  const needle = freeText.trim().toLowerCase();
  return candidates.filter((c) => {
    if (needle && !searchableText(c).includes(needle)) return false;
    for (const [key, wanted] of Object.entries(filters)) {
      if (wanted.length === 0) continue;
      const field = c.fields.find((f) => f.key === key);
      const have = (field?.values ?? []).map((v) => v.toLowerCase());
      const extra =
        key === "specialization"
          ? [c.specialization?.toLowerCase() ?? ""]
          : key === "region"
            ? [c.region?.toLowerCase() ?? ""]
            : [];
      const pool = [...have, ...extra];
      // OR within one parameter, AND across parameters.
      if (!wanted.some((w) => pool.some((v) => v.includes(w.toLowerCase())))) return false;
    }
    return true;
  });
}
