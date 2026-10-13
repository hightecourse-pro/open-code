/**
 * The coordinators' rating vocabulary - the owner's ORIGINAL wording from the
 * historical review files (the owner, 13/10: "הדירוג של תקשורת וכישרון צריך
 * להיות עם הטקסטים המקוריים"). The numbers are the import's mapping and stay
 * the stored value; the texts are what everyone sees. Client-safe.
 */
export const COMMUNICATION_SCALE: { value: number; label: string }[] = [
  { value: 5, label: "תקשורתית מעל הממוצע" },
  { value: 3, label: "תקשורתית סטנדרט" },
  { value: 2, label: "פחות תקשורתית" },
];

export const TALENT_SCALE: { value: number; label: string }[] = [
  { value: 5, label: "מוכשרת מאוד" },
  { value: 3, label: "מוכשרת סטנדרט" },
  { value: 2, label: "פחות מוכשרת אבל משקיענית" },
  { value: 1, label: "חלשה" },
];

/** The text for a stored rating: the row's own verbatim label first (an
 *  imported spelling like "בינונית" stays as written), then the vocabulary. */
export function ratingLabel(
  kind: "communication" | "talent",
  value: number | null | undefined,
  stored?: string | null
): string | null {
  if (stored && stored.trim()) return stored.trim();
  if (value === null || value === undefined) return null;
  const scale = kind === "communication" ? COMMUNICATION_SCALE : TALENT_SCALE;
  return scale.find((s) => s.value === value)?.label ?? `${value}/5`;
}
