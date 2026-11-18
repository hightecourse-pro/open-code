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
  privateRoomPaid: "שולם חדר פרטי",
  baby: "תינוק",
  babyLodging: "לינת תינוק",
  babyLodgingPaid: "שולם תינוק לינה",
  sitterEvening: "ערב שמרטפיה",
  sitterEveningPaid: "שולם תינוק ערב",
  sitterMorning: "בוקר שמרטפיה",
  sitterMorningPaid: "שולם תינוק בוקר",
  laptopOwn: "מחשב נייד",
  laptopRental: "מחשב נייד השכרה",
  laptopRentalPaid: "מחשב נייד שולם",
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

/** Frontal = both frontal tracks; the owner wants the digital and frontal lists apart. */
export const isFrontal = (t: TrackKey) => t === "frontal" || t === "frontalLodging";

export const yes = (v: string | undefined): boolean => (v ?? "").trim() === "כן";

/*
  The paid items (the owner, 18/11: ״תסמן לי כמה בחרו לינה ולא כתוב ששולם - כך
  בכל סעיפי התשלום: מחשב, תינוק (בוקר, ערב)״): a ״chosen״ column and its ״paid״
  column. Lodging also comes with the track ״פרונטלי כולל לינה״, where the
  company paid for it - those are counted apart from the ones who paid themselves.
*/
export const PAID_ITEMS = [
  { key: "lodging", label: "לינה", chosen: P.lodging, paid: P.lodgingPaid },
  { key: "privateRoom", label: "חדר פרטי", chosen: P.privateRoom, paid: P.privateRoomPaid },
  { key: "laptopRental", label: "השכרת מחשב נייד", chosen: P.laptopRental, paid: P.laptopRentalPaid },
  { key: "babyLodging", label: "לינת תינוק", chosen: P.babyLodging, paid: P.babyLodgingPaid },
  { key: "sitterEvening", label: "שמרטפיה בערב", chosen: P.sitterEvening, paid: P.sitterEveningPaid },
  { key: "sitterMorning", label: "שמרטפיה בבוקר", chosen: P.sitterMorning, paid: P.sitterMorningPaid },
] as const;
export type PaidKey = (typeof PAID_ITEMS)[number]["key"];

/** One participant as the dashboard needs her - small enough to send all of them to the browser. */
export interface DashRow {
  /** the sheet row, 1-based (row 1 is the header) */
  row: number;
  num: string;
  name: string;
  company: string;
  course: string;
  track: TrackKey;
  trackLabel: string;
  role: string;
  phone: string;
  mail: string;
  baby: boolean;
  laptopOwn: boolean;
  /** a key present = she chose the item; the value = the sheet says it was paid */
  items: Partial<Record<PaidKey, boolean>>;
}

/** A name from one of the smaller tabs (cancellations, day 3, staff) - for the drawer behind those counts. */
export interface NameRow {
  row: number;
  name: string;
  sub: string;
}
