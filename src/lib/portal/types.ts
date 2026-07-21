// Candidate shapes shared by the server loader and the client filter UI.
// Kept in their own module (with no server imports) so a Client Component can
// use them without dragging next/headers into the browser bundle.

export interface CandidateField {
  key: string;
  label: string;
  /** Display-ready value(s). */
  values: string[];
  kind: "chips" | "text" | "links";
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
