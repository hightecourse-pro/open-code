// What a team reads about its own project (the owner, 5/11: ״לחשוף למגישות את
// הפידבק של הפרויקט שלהם מהבדיקה של ה-AI בלי הנקודות אבל כן לפי הקריטריונים,
// שכן יהיה כתוב מה לא עבד טוב כדי שיבינו למה לא עלו״). The review's note per
// criterion was written for the judges, with the points in mind - this file
// turns it into the team's version: the same findings, no score, no band, no
// deduction talk. No imports, so a tool script can run the same code over
// every report.

export interface FeedbackCriterion {
  key: string;
  label: string;
  hint: string;
  text: string;
}

export interface MemberFeedback {
  /** When the review ran (its own stamp, else the row's). */
  ranAt: string | null;
  /** What stopped the run altogether - a login screen, a dead address. */
  blocked: string | null;
  /** Reached the finals of 28.10 - then the card skips the line about the finals (the owner, 6.11). */
  finalist: boolean;
  criteria: FeedbackCriterion[];
}

/** Deduction talk → ״לשיפור״; score talk → gone. Order matters: the longer phrases first. */
const PHRASES: [RegExp, string][] = [
  [/שתי נקודות ירדו על קטנות:/g, "לשיפור, קטנות:"],
  [/מה שמוריד:/g, "לשיפור:"],
  [/הורדתי נקודות כי /g, "לשיפור: "],
  [/הורדתי נקודה אחת על /g, "לשיפור: "],
  [/ניקוי של \d+ נקודות על /g, "לשיפור: "],
  [/נקודה אחת פחות:/g, "לשיפור:"],
  [/(^|\s)ההורדה:/g, "$1מה שפוגע:"],
  [/מומלץ לשופטות/g, "כדאי"],
  [/נקודה ירדה כי /g, "לשיפור: "],
  [/נקודה אחת יורדת על /g, "לשיפור: "],
  [/הורדתי נקודות על /g, "לשיפור: "],
  [/הורדתי נקודה על /g, "לשיפור: "],
  [/שתי נקודות לחובה:/g, "לשיפור:"],
  [/נקודה אחת לחובה:/g, "לשיפור:"],
  [/שני דברים מורידים:/g, "שני דברים לשיפור:"],
  [/(^|[\s(])מוריד:/g, "$1לשיפור:"],
  [/ניכוי קטן:/g, "לשיפור:"],
  [/ניכוי:/g, "לשיפור:"],
  [/ההפחתה הקטנה -/g, "לשיפור -"],
  [/הניקוד הופחת מעט רק בגלל /g, "ההסתייגות היחידה: "],
  [/הניקוד הופחת בגלל /g, "לשיפור: "],
  [/ניקוד חלקי כי /g, ""],
  [/ניקוד חלקי - /g, ""],
  [/לכן הציון מתבסס על/g, "לכן ההערכה מתבססת על"],
  [/אז הניקוד על הקיום והקוד/g, "אז ההערכה על הקיום והקוד"],
  [/(^|\s)הציון: /g, "$1בשורה אחת: "],
  [/\s?לכן לא ציון מלא\./g, ""],
  [/, ולכן לא 0\./g, "."],
  [/\s?לכן לא 0\./g, ""],
  [/\s?אי אפשר לתת נקודות על זרימה שלא נראתה\./g, ""],
];

/** A sentence that is still about the score after the phrases ran - dropped whole. */
const SCORE_SENTENCE = /ציון בתחום|רצועה|ניקוד|נקודות ירדו|נקודה ירדה|ציון מלא|(^|\s)הציון\s|בונוס על|ההורדה מ-\d|ירידה מ-\d/;
/** ״ציון״ the technical word - a confidence score, a rerank score, a chunk's score - stays. */
const TECHNICAL = /ציון ביטחון|ציון הביטחון|שער ציון|ציון ה-rerank|ציון לקטע|ציוני |הציונים של המודל/;

export function scrubNote(text: string): string {
  let s = text.trim();
  for (const [re, to] of PHRASES) s = s.replace(re, to);
  // A bare ״23.״ after a sentence - the reviewer's own tally, at the end of a note or in its middle.
  s = s.replace(/(?<=[.!?])\s\d{1,2}\.(?=\s|$)/g, "").replace(/\s-\s\d{1,2}\.$/, ".");
  const sentences = s.split(/(?<=[.!?])\s+/);
  s = sentences.filter((x) => !(SCORE_SENTENCE.test(x) && !TECHNICAL.test(x))).join(" ");
  return s.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
}
