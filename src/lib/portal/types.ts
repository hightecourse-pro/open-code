// Candidate shapes shared by the server loader and the client filter UI.
// Kept in their own module (with no server imports) so a Client Component can
// use them without dragging next/headers into the browser bundle.

/** One display-ready experience entry (practical_experience / work_history). */
export interface ExperienceEntryDisplay {
  /** "מקום · סוג/נוכחי · MM.YYYY–MM.YYYY" */
  headline: string;
  /** Resolved tech LABELS. */
  tech: string[];
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
}

export interface CandidateSummary {
  id: string;
  name: string;
  initials: string;
  specialization: string | null;
  region: string | null;
  headline: string[];
  isExperienced: boolean;
}

export interface CandidateDetail extends CandidateSummary {
  bio: string | null;
  fields: CandidateField[];
  links: { label: string; url: string }[];
}

/** One filterable profile parameter offered in the portal search. */
export interface CatalogueField {
  key: string;
  label: string;
  values: string[];
}
