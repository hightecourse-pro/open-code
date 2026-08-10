// The two "experience list" profile questions: practical_experience (the
// junior track's CV-style list of practicums/side jobs) and work_history (the
// experienced track's employment history). Both are special-cased by key in
// the profile wizard (rendered by ExperienceListEditor) and stored in
// profile_answers as a JSON array of entries. Pure module — shared by the
// client editor, the server action validation and the employer portal.

export const PRACTICAL_EXPERIENCE_KEY = "practical_experience";
export const WORK_HISTORY_KEY = "work_history";
export const EXPERIENCE_KEYS = new Set([PRACTICAL_EXPERIENCE_KEY, WORK_HISTORY_KEY]);

export type ExperienceEntry = {
  /** practical_experience only — one of EXPERIENCE_KINDS values. */
  kind?: string;
  place: string;
  /** Tech taxonomy VALUES (labels are resolved at render time). */
  tech: string[];
  description: string;
  /** "YYYY-MM" */
  start: string;
  /** "YYYY-MM" or "current" (= עד היום). */
  end: string;
  /** work_history only — "מקום נוכחי/אחרון"; at most one entry carries it. */
  current?: boolean;
};

export const EXPERIENCE_KINDS: { value: string; label: string }[] = [
  { value: "practicum", label: "פרקטיקום" },
  { value: "paid_work", label: "עבודה בשכר" },
  { value: "unpaid_work", label: "עבודה ללא שכר" },
  { value: "freelance", label: "פרילנס" },
  { value: "private_client", label: "עבודה ללקוח פרטי" },
];

export function experienceKindLabel(value: string | undefined): string {
  if (!value) return "";
  return EXPERIENCE_KINDS.find((k) => k.value === value)?.label ?? value;
}

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidYm(v: string): boolean {
  return YM.test(v);
}

/** Parse a stored answer (or editor JSON) back into clean, typed entries. */
export function parseExperienceEntries(value: unknown): ExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  const out: ExperienceEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const entry: ExperienceEntry = {
      place: typeof o.place === "string" ? o.place.trim() : "",
      tech: Array.isArray(o.tech) ? o.tech.filter((t): t is string => typeof t === "string" && !!t.trim()) : [],
      description: typeof o.description === "string" ? o.description.trim() : "",
      start: typeof o.start === "string" ? o.start.trim() : "",
      end: typeof o.end === "string" ? o.end.trim() : "",
    };
    if (typeof o.kind === "string" && o.kind.trim()) entry.kind = o.kind.trim();
    if (o.current === true) entry.current = true;
    out.push(entry);
  }
  return out;
}

/**
 * Is a single ADDED entry complete? (The questions themselves may be optional,
 * but every entry the member added must carry its required fields.)
 */
export function isCompleteExperienceEntry(e: ExperienceEntry, requireKind: boolean): boolean {
  if (requireKind && !EXPERIENCE_KINDS.some((k) => k.value === e.kind)) return false;
  if (!e.place) return false;
  if (!e.description) return false;
  if (!isValidYm(e.start)) return false;
  if (e.end !== "current" && !isValidYm(e.end)) return false;
  return true;
}

/** "YYYY-MM" → "MM.YYYY" (portal display). */
export function formatYm(ym: string): string {
  const [y, m] = ym.split("-");
  return y && m ? `${m}.${y}` : ym;
}

/** "MM.YYYY–MM.YYYY" (or "MM.YYYY–היום"). */
export function experienceRangeLabel(e: ExperienceEntry): string {
  if (!e.start) return "";
  const end = e.end === "current" ? "היום" : e.end ? formatYm(e.end) : "";
  return end ? `${formatYm(e.start)}–${end}` : formatYm(e.start);
}
