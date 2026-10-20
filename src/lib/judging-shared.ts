// Client-safe constants of שיפוט ההאקתון (the owner, 16/10; the original
// feature added 20/10: "חשוב להוסיף בהגשה דגש על פיצ׳ר מקורי ולהכניס לניקוד").

export type CriterionKey = "works" | "correctness" | "problem" | "original" | "architecture" | "ux" | "presentation";

export interface Criterion {
  key: CriterionKey;
  label: string;
  max: number;
  hint: string;
}

/** The rubric - 100 points, seven criteria. */
export const CRITERIA: Criterion[] = [
  { key: "works", label: "עובד מקצה לקצה", max: 25, hint: "התסריט המלא רץ במוצר החי, בלי נפילות" },
  { key: "correctness", label: "נכונות ואמינות", max: 25, hint: "מספרים נכונים, ״לא יודע״ במקום ניחוש, ציטוט מקור" },
  { key: "problem", label: "פתרון לבעיה האמיתית", max: 15, hint: "עונה למה שהארגון ביקש, לא לגרסה נוחה שלה" },
  { key: "original", label: "פיצ׳ר מקורי", max: 10, hint: "משהו שהארגון לא ביקש ובאמת היה רוצה - מוסבר בהגשה ועובד במוצר החי" },
  { key: "architecture", label: "ארכיטקטורה ושימוש ב-AI", max: 10, hint: "המודל במקום הנכון, כלים ולא פרומפט ענק, הסבר ברור של הבעיות והפתרונות" },
  { key: "ux", label: "חוויית המשתמש", max: 10, hint: "עברית טובה, ברור מה קורה, התאוששות משגיאה" },
  { key: "presentation", label: "הצגה", max: 5, hint: "סרטון של דקה שמראה את המערכת, לא מצגת" },
];

/** Below this on correctness the total is capped - a system that invents cannot win. */
export const CORRECTNESS_FLOOR = 10;
export const CAPPED_TOTAL = 60;
/** Two judges further apart than this call for a third. */
export const GAP_THRESHOLD = 15;

export type Scores = Record<CriterionKey, number>;

export const ZERO_SCORES: Scores = { works: 0, correctness: 0, problem: 0, original: 0, architecture: 0, ux: 0, presentation: 0 };

export function totalOf(s: Scores): { raw: number; total: number; capped: boolean } {
  const raw = CRITERIA.reduce((sum, c) => sum + (s[c.key] ?? 0), 0);
  const capped = (s.correctness ?? 0) < CORRECTNESS_FLOOR && raw > CAPPED_TOTAL;
  return { raw, total: capped ? CAPPED_TOTAL : raw, capped };
}

export type CheckStatus = "pass" | "fail" | "warn" | "skip";
export interface AutoCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail?: string;
}
export interface AutoReport {
  ranAt?: string;
  checks?: AutoCheck[];
  summary?: string;
  suggested?: Partial<Scores>;
  screenshots?: string[];
}
