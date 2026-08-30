// Candidate shapes shared by the server loader and the client filter UI.
// Kept in their own module (with no server imports) so a Client Component can
// use them without dragging next/headers into the browser bundle.

/** One display-ready experience entry (practical_experience / work_history). */
export interface ExperienceEntryDisplay {
  /** "מקום · סוג/נוכחי · MM.YYYY–MM.YYYY" (kept for search/back-compat). */
  headline: string;
  /** Structured pieces so the card can lay the entry out properly (31/8). */
  role?: string;
  place: string;
  /** "MM.YYYY–MM.YYYY" or "MM.YYYY–היום". */
  range: string;
  current?: boolean;
  kindLabel?: string;
  /** Resolved tech LABELS. */
  tech: string[];
  /** May be sanitized rich HTML — render through the safe-rich helper. */
  description: string;
}

export interface CandidateField {
  key: string;
  label: string;
  /** Display-ready value(s) (also what the free-text search matches on). */
  values: string[];
  kind: "chips" | "text" | "links" | "experience";
  /** Only for kind === "experience". */
  entries?: ExperienceEntryDisplay[];
  /** chips backed by the tech taxonomy — same values, grouped by תת-נושא. */
  chipGroups?: { name: string; values: string[] }[];
  /** kind === "links": the structured items (title + note per URL). */
  linkItems?: { url: string; title: string; note: string }[];
}

export interface CandidateSummary {
  id: string;
  name: string;
  initials: string;
  specialization: string | null;
  region: string | null;
  headline: string[];
  isExperienced: boolean;
  /** Surfaced only when the recruiter explicitly toggled mentors on. */
  isMentor?: boolean;
}

export interface CandidateDetail extends CandidateSummary {
  bio: string | null;
  fields: CandidateField[];
  links: { label: string; url: string; note?: string }[];
}

/** One filterable profile parameter offered in the portal search. */
export interface CatalogueField {
  key: string;
  label: string;
  values: string[];
}
