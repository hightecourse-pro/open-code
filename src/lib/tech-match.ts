/**
 * Canonical technology matching.
 *
 * Job tags are typed free-hand by admins ("node", "JS", "SQL...", "pyton"),
 * while a member's skills are canonical taxonomy values ("nodejs",
 * "javascript", "sql", "python"). Exact string comparison between the two —
 * which is what the jobs board used to do — silently missed most real matches:
 * a member with SQL in her profile was not offered a job tagged "SQL...".
 *
 * Both sides now reduce to the same canonical key before comparing.
 */

/**
 * Collapse a raw technology string to its canonical key: lowercase, keeping
 * only letters, digits, Hebrew, and the two characters that distinguish real
 * technology names (# and +). "SQL..." → "sql", "Node.js" → "nodejs",
 * ".NET" → "net", "React Native" / "react_native" → "reactnative".
 */
export function canonicalTech(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9#+֐-׿]/g, "");
}

/**
 * Spellings that mean an existing canonical key. Left side is the canonical
 * form of what admins actually typed into job tags on the live site; right
 * side is the canonical form of the taxonomy value it means.
 */
const TECH_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  node: "nodejs",
  py: "python",
  pyton: "python", // seen in live data
  postgres: "postgresql",
  reactjs: "react",
  dotnet: "net",
  golang: "go",
  angularjs: "angular",
  vuejs: "vue",
};

/** The comparable key for any raw technology string, aliases resolved. */
export function techKey(raw: string): string {
  const canon = canonicalTech(raw);
  return TECH_ALIASES[canon] ?? canon;
}

/**
 * Map from tech key → display label, built from the taxonomy (both value and
 * Hebrew label resolve). Lets the save path store the pretty label for a
 * recognized free-typed tag ("pyton" → "Python") while leaving genuinely
 * unknown tags as typed.
 */
export function buildTechLabelMap(
  taxonomy: { value: string; label_he: string }[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of taxonomy) {
    map.set(techKey(t.value), t.label_he);
    map.set(techKey(t.label_he), t.label_he);
  }
  return map;
}
