/*
  הייטקורס 2026 - the pre-conference mail and the preparation questionnaire
  (the owner, 19/11: ״אני רוצה שאתה תנהל את זה ותשלח… הנתונים צריכים להילקח
  מגיליון המשתתפות״). What is shared by the public form (client), the mail
  builder and the server: the courses and which questionnaire each one gets,
  the questions, the dates and the addresses. No server imports here.
*/

/** The conference as the mail states it (the sheet's ״הגדרות״ tab, read 19/11). */
export const CONF = {
  title: "הייטקורס 2026",
  /** The owner, 19/11 night: ״בכל מקום תוסיף גם תאריך עברי לפני הלועזי״ - the Hebrew date always comes first. */
  dates: "24-26 בנובמבר 2026",
  hebrewDates: "י״ד-ט״ז בכסלו תשפ״ז",
  firstDay: "יום שלישי, י״ד בכסלו, 24.11",
  venue: "מלון VERT ירושלים",
  /** The owner, 19/11 (evening): ״תעשה את הרישום ללינה, שמרטפיה, מחשב עד מוצאי שבת בשעה 23:00 בלילה״. */
  deadline: "מוצאי שבת, י״א בכסלו, 21.11, בשעה 23:00",
  deadlineShort: "מוצאי שבת י״א בכסלו 21.11 בשעה 23:00",
  deadlineIso: "2026-11-21T23:00:00+02:00",
  /** The personal area (the owner, 19/11: ״זה הלינק לאזור האישי״). */
  site: "https://hightecourse.com/personal-area",
  laptopRentalNis: 50,
  replyTo: "office@hightecourse.com",
  /** ״כל שאלה טכנית בענייני לינה/שמרטפיה וכו׳ לשלוח ליהודית״. */
  logistics: { name: "יהודית", mail: "share@hightecourse.com" },
  subject: "הייטקורס 2026 - מידע חשוב לפני הכנס",
  fromName: "הייטקורס",
  /** The program image: shown in the letter and attached to the mail (the owner: ״התוכניה מצורפת כאן״). */
  programPath: "/hightecourse/program-2026.jpg",
  programFileName: "hightecourse-2026-program.jpg",
} as const;

/** Which questionnaire a course gets. */
export type PrepKind = "dev" | "ai" | "role" | "soft" | "mgmt" | "unknown";

export const KIND_LABEL: Record<PrepKind, string> = {
  dev: "פיתוח - מחשב + כלי AI לפיתוח",
  ai: "AI - מחשב + כלי AI",
  role: "בלי מחשב - תפקיד",
  soft: "בלי מחשב - תפקיד ומשרד",
  mgmt: "בלי מחשב - שאלון ניהול",
  unknown: "קורס לא מזוהה",
};

/**
 * The owner's lists (19/11). The sheet's course text is matched after
 * normalising (spaces, the dash variants, the double-yud of ״מצויינות״):
 * exactly, or by prefix for a text that carries a note after the name.
 */
export const COURSES: { name: string; kind: PrepKind }[] = [
  { name: "Advanced GenAI & Agentic AI for Developers - מהבסיס כולל תרגול", kind: "dev" },
  { name: "Vibe Coding - פיתוח מקצה לקצה באמצעות כלי AI", kind: "dev" },
  { name: "יישום ופיתוח Salesforce בעידן ה־AI", kind: "dev" },
  { name: "UX מתקדם למעצבים מנוסים בעידן ה-AI", kind: "ai" },
  { name: "AI מתקדם למנהלים ומנתחי מערכות", kind: "ai" },
  { name: "AI מתקדם לבדיקות ואוטומציה", kind: "ai" },
  { name: "Cloud Data & AI Agents for BI Developers", kind: "ai" },
  { name: "Advanced GenAI & Agentic AI for Developers - מתקדם מאוד", kind: "role" },
  { name: "מיומנויות רכות בעולם העבודה החדש", kind: "soft" },
  { name: "מצוינות בניהול", kind: "mgmt" },
];

export const normCourse = (s: string): string =>
  s
    .replace(/[־–—]/g, "-")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/מצויינות/g, "מצוינות")
    .trim()
    .toLowerCase();

/**
 * The sheet's course text → the canonical course, its questionnaire, the
 * note the sheet put after the name (״נדרש אישור חברה למעבר״, ״נדרש לבחור
 * בסיסי או מתקדם״ - printed prominently in the mail, the owner, 19/11) and,
 * rarely, why the mail must wait (no course at all, a name not on the list).
 */
export function resolveCourse(raw: string): { course: string; kind: PrepKind; note: string | null; hold: string | null } {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { course: "", kind: "unknown", note: null, hold: "אין קורס בגיליון" };
  if (normCourse(text) === "נופש") return { course: "קורס נופש", kind: "role", note: null, hold: null };
  // ״<course> - נדרש …״: the note after the dash
  const split = text.match(/^(.*?)\s*[-־–—]\s*(נדרש .*)$/);
  const base = split ? split[1].trim() : text;
  const note = split ? split[2].trim() : null;
  const n = normCourse(base);
  const exact = COURSES.find((c) => normCourse(c.name) === n);
  if (exact) return { course: exact.name, kind: exact.kind, note, hold: null };
  const prefix = COURSES.find((c) => n.startsWith(normCourse(c.name)));
  if (prefix) return { course: prefix.name, kind: prefix.kind, note, hold: null };
  // a note without a decided course (״נדרש לבחור בסיסי או מתקדם״, ״נדרש לבחור קורס פרונטלי אחר״)
  if (note) return { course: base, kind: "unknown", note, hold: null };
  return { course: text, kind: "unknown", note: null, hold: "קורס לא מזוהה ברשימה" };
}

/** The laptop courses, when the sheet's ״קורסים״ tab does not say (״מחשב״ = כן). */
export const kindNeedsLaptop = (kind: PrepKind): boolean => kind === "dev" || kind === "ai";

/**
 * What must be installed on the laptop, per course (the owner, 19/11 night, for
 * ״Advanced GenAI… מהבסיס כולל תרגול״: ״רשימת התקנה נדרשת על המחשב: nodejs, npm,
 * Docker Desktop, Vscode״). Printed in the mail's laptop block and in the questionnaire.
 */
export const INSTALL_TITLE = "רשימת התקנה נדרשת על המחשב:";
export const INSTALL_LISTS: { course: string; items: string[] }[] = [
  { course: "Advanced GenAI & Agentic AI for Developers - מהבסיס כולל תרגול", items: ["Node.js", "npm", "Docker Desktop", "VS Code"] },
];
export const installListFor = (course: string): string[] | null => {
  const n = normCourse(course);
  return INSTALL_LISTS.find((l) => normCourse(l.course) === n)?.items ?? null;
};

/* ---- the questionnaire ---- */

export const DEV_TOOLS = ["Claude Code", "Kiro", "Amazon Q", "GitHub Copilot", "Cursor"] as const;
export const AI_TOOLS = ["Gemini", "Claude", "ChatGPT"] as const;
export const TOOL_OTHER = "אחר";
export const TOOL_NONE = "אין לי כלי AI עם רישיון";

export type LicenseSource = "work" | "private" | "both";
export const LICENSE_LABEL: Record<LicenseSource, string> = { work: "רישיון מהעבודה", private: "רישיון פרטי", both: "גם מהעבודה וגם פרטי" };

/** What she answers; every field optional in the type, the form decides what is required per kind. */
export interface PrepAnswers {
  role?: string;
  office?: string;
  /** "yes" | "no" - comes with a laptop */
  laptop?: "yes" | "no";
  tools?: string[];
  toolsOther?: string;
  license?: LicenseSource | "";
  /** the management course */
  mgmtRole?: string;
  employees?: string;
  years?: string;
  note?: string;
}

/** The form's sections per questionnaire. */
export function questionsFor(kind: PrepKind, laptopRequired: boolean): { role: boolean; office: boolean; laptop: boolean; tools: "dev" | "ai" | null; mgmt: boolean } {
  switch (kind) {
    case "dev":
      return { role: true, office: false, laptop: true, tools: "dev", mgmt: false };
    case "ai":
      return { role: true, office: false, laptop: true, tools: "ai", mgmt: false };
    case "role":
      return { role: true, office: false, laptop: false, tools: null, mgmt: false };
    case "soft":
      return { role: true, office: true, laptop: false, tools: null, mgmt: false };
    case "mgmt":
      return { role: false, office: true, laptop: false, tools: null, mgmt: true };
    default:
      return { role: true, office: false, laptop: laptopRequired, tools: null, mgmt: false };
  }
}

/** The texts the owner dictated (19/11), word for word where she gave them. */
export const TEXT = {
  noLaptopOption: `אין לך מחשב נייד? אפשר להשכיר מחשב באזור האישי באתר הייטקורס במחיר של ${CONF.laptopRentalNis} ש״ח למחשב לשעות הקורס - עד ${CONF.deadline}, כדי שנספיק להזמין.`,
  noToolsNote: "בכלי חינמי האפשרויות מוגבלות, ויתכן שתצטרכי לתרגל עם חברה.",
  employeesHint: "לא חובה לנהל עובדים - אלא להיות בתפקיד מוביל",
} as const;

/** The public form's path for a token. */
export const prepFormPath = (token: string) => `/hightecourse-2026/prep/${token}`;
