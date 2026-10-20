// Client-safe constants of שיפוט ההאקתון (the owner, 16/10; rewritten 20/10
// to her published text: six criteria for the finals - "בארוע עצמו יהיו
// קריטריונים אחרים כמובן").

export type CriterionKey = "works" | "correctness" | "problem" | "architecture" | "ux" | "original";

export interface Criterion {
  key: CriterionKey;
  label: string;
  max: number;
  hint: string;
}

/** The rubric for the finals - 100 points, six criteria, the owner's own words. */
export const CRITERIA: Criterion[] = [
  { key: "works", label: "עובד מקצה לקצה", max: 25, hint: "התסריט המלא רץ בלינק ששלחת בענן, בלי נפילות" },
  { key: "correctness", label: "נכונות ואמינות", max: 25, hint: "עונה שלא יודע אם אין מידע נכון, ולא ממציא" },
  { key: "problem", label: "פתרון לבעיה האמיתית", max: 15, hint: "האם המוצר עונה למה שהלקוח ביקש? זה פותר את הבעיה?" },
  { key: "architecture", label: "ארכיטקטורה של פיתוח AI", max: 10, hint: "איך בנית את המערכת? האם את יודעת להסביר את זה?" },
  { key: "ux", label: "חוויית משתמש", max: 10, hint: "עד כמה נעים ונוח להשתמש במערכת? איך העיצוב?" },
  { key: "original", label: "פיצ׳ר מקורי שלא חשבו עליו", max: 15, hint: "פה המקום שלך להוכיח חדשנות וחשיבה יצירתית - מוזמנת להפתיע" },
];

/** What the participants read under the rubric. */
export const RUBRIC_NOTE = "אלה הקריטריונים לעלייה לגמר. בערב הגמר עצמו יהיו קריטריונים אחרים, כמובן.";

/** Below this on correctness the total is capped - a system that invents cannot win. */
export const CORRECTNESS_FLOOR = 10;
export const CAPPED_TOTAL = 60;
/** Two judges further apart than this call for a third. */
export const GAP_THRESHOLD = 15;

export type Scores = Record<CriterionKey, number>;

export const ZERO_SCORES: Scores = { works: 0, correctness: 0, problem: 0, architecture: 0, ux: 0, original: 0 };

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
