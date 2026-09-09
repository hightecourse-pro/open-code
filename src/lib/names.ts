/**
 * Admin-facing display name: "פרטי (משפחה)" — the owner (9/9): members
 * sometimes typed family-name-first into full_name, so admin screens show the
 * given name unambiguously with the surname in parentheses. Falls back to
 * full_name when the split fields are missing (older signups).
 */
export function adminDisplayName(p: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
}): string {
  const first = p.first_name?.trim();
  const last = p.last_name?.trim();
  if (first && last) return `${first} (${last})`;
  return p.full_name?.trim() || first || last || "חברת קהילה";
}
