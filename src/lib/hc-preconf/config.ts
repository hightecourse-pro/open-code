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
  /** The greeting (the owner, 20/11: ״מתרגשות ממש לפגוש אותך ביום שלישי י״ד בכסלו, במלוא המרץ״ - Hebrew only). */
  firstDay: "יום שלישי י״ד בכסלו",
  venue: "מלון VERT ירושלים",
  /** The owner, 19/11 (evening): ״תעשה את הרישום ללינה, שמרטפיה, מחשב עד מוצאי שבת בשעה 23:00 בלילה״; 20/11 morning: ״לשנות את הדדליין לראשון הקרוב ב-10 בבוקר בכל המקומות״ - this wording everywhere. */
  deadline: "יום ראשון הקרוב בשעה 10:00 בבוקר",
  deadlineIso: "2026-11-22T10:00:00+02:00",
  /** The personal area (the owner, 19/11: ״זה הלינק לאזור האישי״). */
  site: "https://hightecourse.com/personal-area",
  laptopRentalNis: 50,
  replyTo: "office@hightecourse.com",
  /** ״כל שאלה טכנית בענייני לינה/שמרטפיה וכו׳ לשלוח ליהודית״. */
  logistics: { name: "יהודית", mail: "share@hightecourse.com" },
  subject: "הייטקורס 2026 - מידע חשוב לפני הכנס",
  fromName: "הייטקורס",
  /** The program image: shown in the letter and attached to the mail (the owner: ״התוכניה מצורפת כאן״); v2 = the updated program of 20/11 - a new name so mail image proxies never serve the old one. */
  programPath: "/hightecourse/program-2026-v2.jpg",
  programFileName: "hightecourse-2026-program.jpg",
  /** The caterer's logo beside ״ארוחות צהריים וערב״ (the owner, 20/11: ״צרפתי לוגו של הקייטרינג״). */
  cateringLogoPath: "/hightecourse/catering-logo.png",
  /**
   * The personal area closes for lodging / babysitting / laptop rental (the owner, 22/11: ״אנחנו מעבירים את שיבוץ
   * החדרים למלון היום… האזור האישי באתר ייסגר לעדכון לינה/שמרטפיה/השכרת מחשב״; ~13:20: ״תשנה את הסגירה ל-15:00
   * באופן סופי״; ~14:55: ״תעביר את הדדליין ל-16:00 בגלל השעה״; ~16:05: ״תשנה את השעה ל-16:30 ותשלח״). The course
   * update mail says ״נסגר היום בשעה 16:30״ until then and ״סגור״ afterwards (the same mail reaches later registrants).
   */
  personalAreaClose: "היום (יום ראשון, י״ב בכסלו, 22.11) בשעה 16:50",
  personalAreaCloseShort: "היום בשעה 16:50",
  personalAreaCloseIso: "2026-11-22T16:50:00+02:00",
} as const;

/** Is the personal area still open for lodging / babysitting / rental changes at `now`? */
export const personalAreaOpenAt = (now: Date = new Date()): boolean => now.getTime() < new Date(CONF.personalAreaCloseIso).getTime();

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
  // 22/11 ~14:55, the owner's list for the course update (״רשימה להתקין: Docker, Node.js, Cursor, Claude code - למי שיש חשבון״) - the questionnaire shows the same one
  { course: "Advanced GenAI & Agentic AI for Developers - מהבסיס כולל תרגול", items: ["Docker", "Node.js", "Cursor", "Claude Code - למי שיש חשבון"] },
];
export const installListFor = (course: string): string[] | null => {
  const n = normCourse(course);
  return INSTALL_LISTS.find((l) => normCourse(l.course) === n)?.items ?? null;
};

/* ---- the per-course update mail (the owner, 22/11) ---- */

/** An installation item: a plain text, or a label that links to the download. */
export type InstallItem = string | { label: string; href: string };

export interface CourseUpdate {
  course: string;
  /** paragraphs at the top of ״מה צריך לקורס״ - the first one bold */
  lines: string[];
  /** a list in a yellow box BEFORE the laptop line (Salesforce: the accounts and the practice org) */
  before?: { title: string; items: InstallItem[]; note?: string };
  /** a list in a yellow box under the laptop line (a course without one falls back to INSTALL_LISTS, if it has an entry there) */
  installs?: { title: string; items: InstallItem[]; note?: string };
  /** paragraphs after the laptop / installation / rental block */
  after?: string[];
  /** an extra numbered step with a document: linked from the mail (served from /public) and attached to it */
  doc?: { title: string; text: string[]; path: string; fileName: string; linkText: string };
  /** the form step's red line, when the course wants its own (default: UPDATE_TEXT.fillForm) */
  formText?: string;
  /** the course needs no AI tool (the lecturer provides): no tools question in the questionnaire, no pairs note in the mail */
  noAiTools?: boolean;
}

/**
 * ״צריך לשלוח לכל קורס עדכון על הכלים הנדרשים לקורס״ - the course text the owner dictates, course by course; a course
 * without an entry has no update mail yet (the admin card says so).
 */
export const COURSE_UPDATES: CourseUpdate[] = [
  {
    course: "AI מתקדם למנהלים ומנתחי מערכות",
    lines: ["לקורס זה אין התקנות נדרשות על המחשבים.", "רוב התרגול ניתן לבצע גם בכלי AI חינמיים. במקרים בהם נדרש רישיון - ניתן לבצע תרגול בזוגות."],
  },
  {
    // the owner, 22/11 ~14:05 (״בקורס הזה תכתוב רשימת התקנות מומלצת… במידה ויש לך בעיה להתקין… רוב התרגול… בקורס זה יוצאים עם מוצר מקצה לקצה…״)
    course: "Vibe Coding - פיתוח מקצה לקצה באמצעות כלי AI",
    lines: [],
    installs: {
      title: "רשימת התקנות מומלצת על המחשב:",
      items: ["Node.js - גרסת LTS", "Visual Studio Code", "Claude Desktop", "Git for Windows"],
      note: "במידה ויש לך בעיה להתקין על המחשב - המרצה ייתן דרכים חלופיות.",
    },
    after: ["רוב התרגול יכול להתבצע בכלי AI חינמיים. במידה ונדרש כלי AI עם רישיון ואין לך - ניתן לבצע את החלק הזה בזוגות."],
    doc: {
      title: "רוצה לצאת עם מוצר משלך?",
      text: [
        "בקורס זה יוצאים עם מוצר מקצה לקצה. אם את רוצה לבוא עם מוצר משלך שאת רוצה לפתח - מוזמנת לבנות מסמך מוצר לפי ההוראות במסמך המצורף (כמובן שגם אותו את יכולה להכין עם כל צ׳אט AI: מעלים לו את המסמך ומספרים לו על הרעיון).",
        "אם תבואי בלי רעיון למוצר - תקבלי את הרעיון מהמרצה :)",
      ],
      path: "/hightecourse/vibe-coding-2026-prep.pdf",
      fileName: "vibe-coding-2026-prep.pdf",
      linkText: "למסמך ההכנה (PDF)",
    },
  },
  {
    // the owner, 22/11 ~14:55 (״רשימה להתקין: Docker, Node.js, Cursor, Claude code - למי שיש חשבון. מי שלא יכול להתקין - ניתן להסתדר גם ללא התקנות מקומיות. שאר ההנחיות… כמו בראשון״)
    course: "Advanced GenAI & Agentic AI for Developers - מהבסיס כולל תרגול",
    lines: [],
    installs: {
      title: "רשימת התקנות על המחשב:",
      items: ["Docker", "Node.js", "Cursor", "Claude Code - למי שיש חשבון"],
      note: "מי שלא יכולה להתקין - ניתן להסתדר גם ללא התקנות מקומיות.",
    },
    after: ["רוב התרגול יכול להתבצע בכלי AI חינמיים. במידה ונדרש כלי AI עם רישיון ואין לך - ניתן לבצע את החלק הזה בזוגות."],
  },
  {
    // the owner, 22/11 ~15:50 (״תכתוב שלא נדרש מחשב נייד כי הקורס ללא תרגול כי הוא ממוקד בהספקים רבים ככל האפשר ויכיל את החומרים הכי מתקדמים בתחום. השאר כרגיל״)
    course: "Advanced GenAI & Agentic AI for Developers - מתקדם מאוד",
    lines: ["לקורס זה לא נדרש מחשב נייד.", "הקורס ללא תרגול, כי הוא ממוקד בהספקים רבים ככל האפשר ויכיל את החומרים הכי מתקדמים בתחום."],
  },
  {
    // the owner, 22/11 ~16:10 (״Figma הורדה, מותקנת, אפליקציית דסקטופ וחשבון מחובר. מנוי בתשלום עדיף, חינמי בסדר. מנוי לכלי AI. מומלץ Claude Pro, $20 לחודש: עליו נלמד…״)
    course: "UX מתקדם למעצבים מנוסים בעידן ה-AI",
    lines: [],
    installs: {
      title: "מה להכין על המחשב לפני הסדנה:",
      items: [
        "Figma - להוריד ולהתקין את אפליקציית הדסקטופ, עם חשבון מחובר. מנוי בתשלום עדיף, חינמי בסדר.",
        "מנוי לכלי AI - מומלץ Claude Pro ($20 לחודש): עליו נלמד. אפשר גם ChatGPT Plus או Gemini במנוי בתשלום.",
      ],
      note: "במידה ואין לך מנוי בתשלום - תשתמשי בגרסה החינמית, שבה מספר ההודעות מוגבל; היא יכולה להיגמר באמצע התרגיל, ואז תצטרפי לתרגול בזוגות.",
    },
    after: ["שווה להיכנס לשני הכלים פעם אחת לפני הסדנה, כדי להתחיל לעבוד מהדקה הראשונה."],
  },
  {
    // the owner, 22/11 ~16:25 (״זו רשימת ההתקנות הנדרשת: NodeJS…, Python…, Google Antigravity IDE…; במידה ויש בעיה - ניתן לתרגל גם בזוגות; במחשב נייד מושכר אין התקנות; השאר כרגיל״)
    course: "AI מתקדם לבדיקות ואוטומציה",
    lines: [],
    installs: {
      title: "רשימת ההתקנות הנדרשת על המחשב (לחיצה מורידה):",
      items: [
        { label: "Node.js", href: "https://nodejs.org/dist/v26.13.1/node-v26.13.1-x64.msi" },
        { label: "Python", href: "https://www.python.org/ftp/python/3.13.5/python-3.13.5-amd64.exe" },
        { label: "Google Antigravity IDE", href: "https://edgedl.me.gvt1.com/edgedl/release2/j0qc3/antigravity/stable/2.7.0-4507555968450560/windows-x64/Antigravity%20IDE.exe" },
      ],
      note: "במידה ויש בעיה - ניתן לתרגל גם בזוגות.",
    },
  },
  {
    // the owner, 22/11 ~16:40 (״במיומנויות רכות תזכיר למלא את הטופס וכל השאר, אין התקנות. הטופס חשוב״)
    course: "מיומנויות רכות בעולם העבודה החדש",
    lines: ["לקורס זה לא נדרש מחשב נייד ואין התקנות."],
    formText: "הטופס חשוב לנו לקראת הקורס - נא למלא אותו בהקדם (דקה אחת):",
  },
  {
    // the owner, 22/11 ~16:55 (״בקורס זה נפתחות 2 קבוצות, לצורך חלוקת הקבוצות בצורה מיטבית - יש למלא בהקדם את התפקיד ושנות הניסיון בטופס. בנוסף, מצורף מסמך הכנה לקורס - מומלץ לקרוא לפני הכנס״)
    // ~16:40: ״בקורס זה נפתחות שתי קבוצות - לא קשור למה צריך לקורס, אפשר לצרף לשלב הבא״ → the sentence opens the form step; no ״מה צריך״ step at all
    course: "מצוינות בניהול",
    lines: [],
    formText: "בקורס זה נפתחות שתי קבוצות. לצורך חלוקת הקבוצות בצורה מיטבית - יש למלא בהקדם את התפקיד ושנות הניסיון בטופס:",
    doc: {
      title: "מסמך הכנה לקורס",
      text: ["מצורף מסמך הכנה לקורס מצוות הסדנה - מומלץ לקרוא לפני הכנס."],
      path: "/hightecourse/management-2026-prep.pdf",
      fileName: "management-2026-prep.pdf",
      linkText: "למסמך ההכנה (PDF)",
    },
  },
  {
    // the owner, 22/11 ~17:05 (״לקורס של ה-BI זה ההתקנות: Git, Docker Desktop. בקורס זה אין צורך בכלי AI המרצה מספק מה שצריך (תסיר מהטופס את הקטע של כלי AI ובמלל במייל). השאר כרגיל״)
    course: "Cloud Data & AI Agents for BI Developers",
    lines: [],
    installs: { title: "רשימת ההתקנות הנדרשת על המחשב:", items: ["Git", "Docker Desktop"] },
    after: ["בקורס זה אין צורך בכלי AI - המרצה מספק מה שצריך."],
    noAiTools: true,
  },
  {
    // the owner, 22/11 ~17:15: the lecturer's preparation text (Trailhead, a Developer Edition org with Agentforce and Data 360,
    // VS Code / Salesforce CLI / Extension Pack / Git, or the browser IDE), ״אין צורך בכלי AI בתשלום. תסיר גם מהטופס״
    course: "יישום ופיתוח Salesforce בעידן ה־AI",
    lines: ["לקראת הקורס, שבו נעסוק ב-Vibe Coding ובבניית סוכנים באמצעות Agentforce - נא להשלים את ההכנות הבאות לפני תחילת הקורס."],
    before: {
      title: "חשבונות וסביבת תרגול:",
      // the links are the lecturer's (her PDF ״סיילספורס״, 22/11 ~17:20)
      items: [
        { label: "הירשמי או התחברי ל-Trailhead", href: "https://trailhead.salesforce.com/" },
        { label: "פתחי סביבת תרגול חינמית של Salesforce Developer Edition עם Agentforce ו-Data 360", href: "https://developer.salesforce.com/free-trials" },
        "ודאי שאת מצליחה להתחבר לסביבה. אם קיבלת פרטי גישה לארגון תרגול אחר - השתמשי בהם במקום לפתוח סביבה חדשה.",
      ],
    },
    installs: {
      title: "התקנות למחשב, לתרגול מקומי:",
      items: [
        { label: "Visual Studio Code", href: "https://code.visualstudio.com/download" },
        { label: "Salesforce CLI", href: "https://developer.salesforce.com/tools/salesforcecli" },
        { label: "Salesforce Extension Pack", href: "https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode" },
        { label: "Git", href: "https://git-scm.com/downloads" },
      ],
      note: "אם נעבוד בכיתה ב-[[Agentforce Vibes IDE בדפדפן|https://developer.salesforce.com/docs/platform/code-builder/guide/codebuilder-overview.html]] - לא תידרש התקנה מקומית, אלא גישה לארגון שבו סביבת ה-IDE הופעלה. נעדכן לפני הקורס באיזה מסלול נעבוד.",
    },
    after: ["אין צורך בכלי AI בתשלום.", "נא להשלים את ההכנות מראש, כדי שנוכל להקדיש את זמן הקורס לתרגול עצמו. נתקלת בבעיה בהתקנה או בהתחברות? כתבי לנו לפני הקורס - פשוט השיבי למייל הזה."],
    noAiTools: true,
  },
];

/** Does the course ask about AI tools at all? (a course with noAiTools in COURSE_UPDATES does not) */
export const courseAsksTools = (course: string): boolean => !courseUpdateFor(course)?.noAiTools;
export const courseUpdateFor = (course: string): CourseUpdate | null => {
  const n = normCourse(course);
  return COURSE_UPDATES.find((c) => normCourse(c.course) === n) ?? null;
};
export const courseUpdateSubject = (course: string) => `${CONF.title} - הכלים הנדרשים לקורס ${course}`;

/** The texts of the update mail the owner dictated (22/11), word for word. */
export const UPDATE_TEXT = {
  fillForm: "כדי שנוכל להתארגן על הנדרש לקורס נא למלא בהקדם את הטופס הזה:",
  pairs: "במידה ואין לך כלי AI ברישיון והתרגיל לא יהיה ניתן לביצוע בכלים חינמיים - ניתן לבצע את התרגיל גם בזוגות.",
  hotelToday: "אנחנו מעבירות היום את שיבוץ החדרים למלון, ולכן לאחר מכן לא ניתן יהיה לבצע שינויים.",
  /** after the closing (the owner, 22/11 ~17:25: ״עדכון מחשב/שמרטפיה/לינה סגור לרישום, ניתן לעדכן את שאר הפרטים״) */
  hotelDone: "הרישום ללינה, לשמרטפיה ולהשכרת מחשב סגור - שיבוץ החדרים הועבר למלון.",
  closedRest: "את שאר הפרטים באזור האישי אפשר לעדכן.",
  /** from 22/11 ~14:55 on, every laptop course (the owner: ״תוסיף מעכשיו והלאה שאנחנו מספקים רשת במלון״) */
  network: "אנחנו מספקות רשת במלון.",
  /** (״מי שמשכירה מחשב הוא מחשב ללא התקנות ותצטרך לדאוג להתקין הכל בעצמה״; ~16:10: ״תדגיש שבמחשב מושכר אין התקנות - יש צורך להתקין בעצמך את כל הנדרש״) */
  rentalNoInstalls: "במחשב מושכר אין התקנות - יש צורך להתקין בעצמך את כל הנדרש.",
  rentalNoInstallsShort: "המחשב מגיע ללא התקנות",
} as const;

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

/** The form's sections per questionnaire (and per course: a course that needs no AI tool drops that question). */
export function questionsFor(kind: PrepKind, laptopRequired: boolean, course?: string): { role: boolean; office: boolean; laptop: boolean; tools: "dev" | "ai" | null; mgmt: boolean } {
  const base = questionsForKind(kind, laptopRequired);
  return course && base.tools && !courseAsksTools(course) ? { ...base, tools: null } : base;
}
function questionsForKind(kind: PrepKind, laptopRequired: boolean): { role: boolean; office: boolean; laptop: boolean; tools: "dev" | "ai" | null; mgmt: boolean } {
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
