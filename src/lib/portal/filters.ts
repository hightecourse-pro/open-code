// Pure candidate filtering — no server imports, so the same implementation
// runs on the server (smart search) and in the browser (instant filtering).

import type { CandidateDetail } from "./types";

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
      // specialization/region live on the profile row, not in the answers.
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
