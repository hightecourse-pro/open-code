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
  /** The reviewer's text: one line per criterion, a video line, a bottom line - kept for older reports. */
  summary?: string;
  suggested?: Partial<Scores>;
  screenshots?: string[];
  /** Structured since 26/10: the reasoned note per criterion, the bottom line, what blocked the run, the video note. */
  notes?: Partial<Record<CriterionKey, string>>;
  bottomLine?: string;
  blocked?: string | null;
  videoNote?: string;
}

/**
 * What the owner reads about a project (26/10): the note per criterion, the
 * video, the bottom line and the blocker - from the structured fields when the
 * report has them, otherwise parsed out of the summary text the review tool
 * writes (״<label> <n>/<max> - <note>״ lines, then ״סרטון:״, ״סיכום:״, ״חסימה:״).
 */
export function readAutoReport(report: AutoReport): { notes: Partial<Record<CriterionKey, string>>; videoNote: string | null; bottomLine: string | null; blocked: string | null } {
  const notes: Partial<Record<CriterionKey, string>> = { ...(report.notes ?? {}) };
  let videoNote = report.videoNote ?? null;
  let bottomLine = report.bottomLine ?? null;
  let blocked = report.blocked ?? null;
  const lines = (report.summary ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(.+?) (\d+)\/(\d+) - (.*)$/);
    if (m) {
      const c = CRITERIA.find((x) => x.label === m[1]);
      if (c && !notes[c.key]) notes[c.key] = m[4];
      continue;
    }
    if (line.startsWith("סרטון:") && !videoNote) videoNote = line.slice(6).trim();
    else if (line.startsWith("סיכום:") && !bottomLine) bottomLine = line.slice(6).trim();
    else if (line.startsWith("חסימה:") && !blocked) blocked = line.slice(6).trim();
  }
  return { notes, videoNote, bottomLine, blocked };
}
