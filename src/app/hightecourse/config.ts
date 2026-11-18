/*
  מערכת ניהול הייטקורס - the owner's management screens over HER Google Sheet
  ״ניהול אתר הייטקורס 2025״ (the owner, 18/11: ״תבנה מערכת ניהול נפרדת להייטקורס
  עם אותו שם ומשתמש וסיסמא של האדמינים בקוד פתוח… כרגע כל הנתונים בגוגל שיטס״).

  The sheet stays the source of truth: the site's Apps Script keeps writing
  to it, we only READ (a read-only token, one batch request per cache window)
  and never touch a cell. Which tabs are shown is decided here, in code - the
  owner strikes and adds tabs in words (״שאל אותי לגבי הגליונות כי לא כולם
  רלוונטיים״). No server imports: the client screens use these too.
*/

/** The owner's sheet; HIGHTECOURSE_SHEET_ID overrides it (a test copy on a preview, if ever). */
export const DEFAULT_HC_SHEET_ID = "1BDT6FKQuY5SqdudEjW3w6lbtb8AFI919QkKusAKBtyE";

export const PATHS = { home: "/hightecourse", participants: "/hightecourse/participants", sheet: (slug: string) => `/hightecourse/sheets/${slug}` } as const;

/** How long a read from the sheet is reused before the next one (seconds). ״רענון״ bypasses it. */
export const SHEET_CACHE_SECONDS = 300;

export type TabGroup = "participants" | "companies" | "courses" | "site";

export const GROUP_LABEL: Record<TabGroup, string> = {
  participants: "משתתפות",
  companies: "חברות וכספים",
  courses: "קורסים ותוכן",
  site: "פניות ואתר",
};

export interface TabDef {
  /** ASCII path segment - the sheet's tab names are Hebrew */
  slug: string;
  /** the tab's exact title in the sheet */
  title: string;
  group: TabGroup;
  /** one line under the title: what the tab holds, in the owner's terms */
  note?: string;
  /** column headers never rendered (site passwords live in the sheet) */
  hiddenColumns?: string[];
}

/** The tabs the system shows, in this order. The site's internals (logins, tokens, OTP, update log) stay out. */
export const TABS: TabDef[] = [
  { slug: "participants", title: "משתתפות", group: "participants", note: "הרישומים של השנה - הדשבורד והטבלה נבנים מכאן" },
  { slug: "cancellations", title: "ביטולים", group: "participants", note: "מי שביטלה את הרישום" },
  { slug: "day3", title: "יום שלישי", group: "participants", note: "נרשמות ליום השלישי של הכנס" },
  { slug: "staff", title: "צוות ומרצים", group: "participants" },
  { slug: "archive", title: "ארכיון משתתפות", group: "participants", note: "כל השנים, לפי שנת רישום" },
  { slug: "companies", title: "חברות", group: "companies", note: "פרטי החברות - בלי פרטי הכניסה לאתר", hiddenColumns: ["שם משתמש", "סיסמה"] },
  { slug: "contacts", title: "אנשי קשר לחברות", group: "companies" },
  { slug: "company-payments", title: "תשלום חברות", group: "companies", note: "חשבוניות, תשלומים ויתרות לפי חברה" },
  { slug: "invoices", title: "חשבוניות", group: "companies" },
  { slug: "company-years", title: "כמה כל חברה רשמה", group: "companies", note: "משתתפות לפי חברה ושנה" },
  { slug: "courses", title: "קורסים", group: "courses", note: "קטלוג הקורסים של השנה" },
  { slug: "digital-courses", title: "קורסים דיגיטליים", group: "courses" },
  { slug: "tracks", title: "מסלולי רישום", group: "courses", note: "המסלולים והמחירים" },
  { slug: "recordings", title: "לינקים להקלטות", group: "courses" },
  { slug: "settings", title: "הגדרות", group: "courses", note: "תאריכי הכנס והמקום, כפי שהאתר מציג" },
  { slug: "inquiries", title: "פניות", group: "site", note: "הודעות מטופס ״צור קשר״ באתר" },
  { slug: "syllabus-requests", title: "בקשות סילבוס", group: "site" },
  { slug: "errors", title: "שגיאות", group: "site", note: "שגיאות שהאתר רשם" },
  { slug: "course-shares", title: "שיתופי קורסים", group: "site", note: "שיתוף חומרי הקורס בדרייב" },
];

export const tabBySlug = (slug: string): TabDef | undefined => TABS.find((t) => t.slug === slug);

/** Column headers that are never rendered anywhere, whatever the tab. */
export const SECRET_COLUMNS = /^(סיסמה|סיסמא|password|טוקן|token|otp)$/i;

/* ---- the participants tab (״משתתפות״), by its own column names ---- */

export const P = {
  num: "מס",
  id: "ת.ז.",
  first: "פרטי",
  last: "משפחה",
  tag: "שם לתג",
  mail: "מייל פרטי",
  workMail: "מייל עבודה",
  phone: "נייד",
  role: "תפקיד",
  course: "קורס",
  digitalCourse: "קורס דיגיטלי",
  certCourse: "קורס לתעודה",
  secondChoice: "קורס בעדיפות שניה",
  hours: "מס שעות",
  track: "מסלול רישום",
  lodging: "לינה",
  lodgingPaid: "שולם לינה",
  privateRoom: "חדר פרטי",
  baby: "תינוק",
  babyLodging: "לינת תינוק",
  sitterEvening: "ערב שמרטפיה",
  sitterMorning: "בוקר שמרטפיה",
  laptop: "מחשב נייד",
  laptopRental: "מחשב נייד השכרה",
  graduate: "בוגרת",
  city: "עיר",
  office: "משרד",
  company: "חברה",
  contact: "איש קשר",
  invoice: "חשבונית מס",
  price: "מחיר לפני מעמ",
  paid: "סכום שולם",
  registeredOn: "תאריך רישום",
  notes: "הערות",
} as const;

/** The registration tracks as the sheet names them, in the legend's order. Anything else is ״אחר״. */
export const TRACKS = [
  { key: "frontal", label: "פרונטלי ללא לינה", color: "#004878" },
  { key: "frontalLodging", label: "פרונטלי כולל לינה", color: "#4A95CF" },
  { key: "digital", label: "דיגיטלי", color: "#F8C800" },
  { key: "other", label: "אחר", color: "#B8C4CF" },
] as const;
export type TrackKey = (typeof TRACKS)[number]["key"];

export function trackKeyOf(value: string): TrackKey {
  const v = value.trim();
  const hit = TRACKS.find((t) => t.key !== "other" && t.label === v);
  return hit ? hit.key : "other";
}

export const yes = (v: string | undefined): boolean => (v ?? "").trim() === "כן";
