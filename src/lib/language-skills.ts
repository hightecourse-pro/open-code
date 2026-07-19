// The "שליטה בשפות" profile field: a repeatable list of (language, level)
// pairs. Rendered as a dedicated matrix in the profile wizard (special-cased
// by question key), stored in profile_answers as [{lang, level}, ...], and
// filterable in the admin candidate finder.

export const LANGUAGE_SKILLS_KEY = "language_skills";

export type LangSkill = { lang: string; level: string };

export const LANG_LEVELS: { value: string; label: string }[] = [
  { value: "native", label: "שפת אם" },
  { value: "fluent", label: "קריאה, כתיבה ודיבור שוטף" },
  { value: "read_write", label: "קריאה וכתיבה" },
];

/** Languages every member is asked about; more can be added freely. */
export const DEFAULT_LANGUAGES = ["עברית", "אנגלית"];

export function langLevelLabel(value: string): string {
  return LANG_LEVELS.find((l) => l.value === value)?.label ?? value;
}

/** Parse a stored answer value back into a clean, deduped skills list. */
export function parseLangSkills(value: unknown): LangSkill[] {
  if (!Array.isArray(value)) return [];
  const out: LangSkill[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as LangSkill).lang === "string" &&
      typeof (item as LangSkill).level === "string" &&
      (item as LangSkill).lang.trim()
    ) {
      const lang = (item as LangSkill).lang.trim();
      if (seen.has(lang)) continue; // dedupe: first entry per language wins
      seen.add(lang);
      out.push({ lang, level: (item as LangSkill).level });
    }
  }
  return out;
}
