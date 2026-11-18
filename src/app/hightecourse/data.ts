import "server-only";
import { unstable_cache } from "next/cache";
import { readSheetsReadonly, sheetTabsMeta, SheetsError, type SheetTabMeta } from "@/lib/google-sheets";
import { DEFAULT_HC_SHEET_ID, P, SECRET_COLUMNS, SHEET_CACHE_SECONDS, TABS, TRACKS, trackKeyOf, yes, type TabDef, type TrackKey } from "./config";

/*
  Reads of the owner's sheet, cached for SHEET_CACHE_SECONDS under the tag
  "hc-sheet" (״רענון״ drops it). The dashboard's tabs come in ONE batch
  request; a tab screen reads its own tab. Every value is the formatted text
  the sheet shows (a ת.ז. keeps its leading zero). Nothing here writes.
*/

export const HC_CACHE_TAG = "hc-sheet";

export function hcSheetId(): string {
  return process.env.HIGHTECOURSE_SHEET_ID?.trim() || DEFAULT_HC_SHEET_ID;
}

export function hcSheetUrl(gid?: number): string {
  return `https://docs.google.com/spreadsheets/d/${hcSheetId()}/edit${gid != null ? `#gid=${gid}` : ""}`;
}

/** A table as the screens use it: the header row, the data rows under it, and when it was read. */
export interface SheetTable {
  title: string;
  header: string[];
  rows: string[][];
  fetchedAt: string;
}

/** Why the sheet could not be read, in a sentence the admin can act on. */
export function sheetErrorText(e: unknown): string {
  if (e instanceof SheetsError) {
    switch (e.hint) {
      case "no_credentials":
        return "חשבון השירות של גוגל לא מוגדר בסביבה הזו.";
      case "api_disabled":
        return "ה-Google Sheets API כבוי בפרויקט של חשבון השירות.";
      case "not_shared":
        return "הגיליון לא משותף עם חשבון השירות (מספיקה הרשאת צפייה).";
      case "not_found":
        return "הגיליון לא נמצא - בדקי את מזהה הגיליון.";
      case "no_tab":
        return "הגליון (הטאב) לא קיים בגיליון - אולי שונה לו השם.";
      default:
        return `גוגל החזיר שגיאה (${e.status}).`;
    }
  }
  return "הקריאה מהגיליון נכשלה.";
}

/** The first row with at least two filled cells is the header; the data rows are everything under it that has content. */
function split(values: string[][]): { header: string[]; rows: string[][] } {
  const trimmed = values.map((r) => r.map((v) => v.trim()));
  let hi = trimmed.findIndex((r) => r.filter(Boolean).length >= 2);
  if (hi < 0) hi = 0;
  const header = (trimmed[hi] ?? []).map((h, i) => h || `עמודה ${i + 1}`);
  const width = header.length;
  const rows = trimmed
    .slice(hi + 1)
    .filter((r) => r.some(Boolean))
    .map((r) => {
      const out = r.slice(0, width);
      while (out.length < width) out.push("");
      return out;
    });
  return { header, rows };
}

/** Drops the columns that must never render (passwords, tokens), by header name. */
function dropSecrets(header: string[], rows: string[][], hidden: string[] = []): { header: string[]; rows: string[][] } {
  const keep = header.map((h) => !SECRET_COLUMNS.test(h) && !hidden.includes(h));
  if (keep.every(Boolean)) return { header, rows };
  const pick = (r: string[]) => r.filter((_, i) => keep[i]);
  return { header: pick(header), rows: rows.map(pick) };
}

const readTabsCached = unstable_cache(
  async (sheetId: string, titles: string[]): Promise<Record<string, string[][]>> => readSheetsReadonly(sheetId, titles),
  ["hc-sheet-tabs"],
  { revalidate: SHEET_CACHE_SECONDS, tags: [HC_CACHE_TAG] }
);

const readMetaCached = unstable_cache(async (sheetId: string) => sheetTabsMeta(sheetId), ["hc-sheet-meta"], { revalidate: SHEET_CACHE_SECONDS, tags: [HC_CACHE_TAG] });

/** The tabs the sheet actually has (gid, size) - for the links into Google Sheets and the ״missing tab״ notice. */
export async function hcTabsMeta(): Promise<{ title: string; tabs: SheetTabMeta[] }> {
  return readMetaCached(hcSheetId());
}

/** One configured tab as a table, secrets removed. */
export async function hcTable(tab: TabDef): Promise<SheetTable> {
  const values = (await readTabsCached(hcSheetId(), [tab.title]))[tab.title] ?? [];
  const s = split(values);
  const { header, rows } = dropSecrets(s.header, s.rows, tab.hiddenColumns);
  return { title: tab.title, header, rows, fetchedAt: new Date().toISOString() };
}

/* ---- the dashboard ---- */

export interface Participant {
  /** the sheet row, 1-based (row 1 is the header) */
  row: number;
  num: string;
  name: string;
  tag: string;
  mail: string;
  phone: string;
  role: string;
  course: string;
  digitalCourse: string;
  certCourse: string;
  track: TrackKey;
  trackLabel: string;
  lodging: boolean;
  privateRoom: boolean;
  baby: boolean;
  laptopRental: boolean;
  company: string;
  office: string;
  city: string;
  price: string;
  paid: string;
  registeredOn: string;
  /** every filled cell, in the sheet's column order - the row's detail view */
  fields: { k: string; v: string }[];
}

export interface CourseCount {
  course: string;
  total: number;
  byTrack: Record<TrackKey, number>;
  /** from the ״קורסים״ tab, when the name matches */
  category: string;
}

export interface Snapshot {
  sheetTitle: string;
  fetchedAt: string;
  participants: Participant[];
  courses: CourseCount[];
  tracks: { key: TrackKey; label: string; color: string; count: number }[];
  companies: { company: string; count: number }[];
  digitalCourses: { course: string; count: number }[];
  certCourses: { course: string; count: number }[];
  counts: {
    participants: number;
    lodging: number;
    privateRoom: number;
    babies: number;
    laptopRentals: number;
    cancellations: number;
    day3: number;
    staff: number;
    companies: number;
    coursesInCatalog: number;
  };
  /** tabs the dashboard expected and the sheet no longer has */
  missingTabs: string[];
  /** the gid of ״משתתפות״ - the links into Google Sheets open on that tab */
  participantsGid: number | null;
}

const DASHBOARD_TABS = ["משתתפות", "ביטולים", "יום שלישי", "צוות ומרצים", "קורסים"];

const norm = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/[־–—]/g, "-")
    .trim()
    .toLowerCase();

function countBy(values: string[]): { key: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    const k = v.trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "he"));
}

export async function hcSnapshot(): Promise<Snapshot> {
  const sheetId = hcSheetId();
  const [meta, raw] = await Promise.all([readMetaCached(sheetId), readTabsCached(sheetId, DASHBOARD_TABS)]);
  const have = new Set(meta.tabs.map((t) => t.title));
  const missingTabs = DASHBOARD_TABS.filter((t) => !have.has(t));
  const fetchedAt = new Date().toISOString();

  const p = split(raw["משתתפות"] ?? []);
  const col = (name: string) => p.header.indexOf(name);
  const c = Object.fromEntries(Object.entries(P).map(([k, name]) => [k, col(name)])) as Record<keyof typeof P, number>;
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "") : "");

  const participants: Participant[] = p.rows.map((r, i) => {
    const trackLabel = cell(r, c.track);
    return {
      row: i + 2,
      num: cell(r, c.num),
      name: `${cell(r, c.first)} ${cell(r, c.last)}`.trim(),
      tag: cell(r, c.tag),
      mail: cell(r, c.mail) || cell(r, c.workMail),
      phone: cell(r, c.phone),
      role: cell(r, c.role),
      course: cell(r, c.course),
      digitalCourse: cell(r, c.digitalCourse),
      certCourse: cell(r, c.certCourse),
      track: trackKeyOf(trackLabel),
      trackLabel,
      lodging: yes(cell(r, c.lodging)),
      privateRoom: yes(cell(r, c.privateRoom)),
      baby: yes(cell(r, c.baby)),
      laptopRental: yes(cell(r, c.laptopRental)),
      company: cell(r, c.company),
      office: cell(r, c.office),
      city: cell(r, c.city),
      price: cell(r, c.price),
      paid: cell(r, c.paid),
      registeredOn: cell(r, c.registeredOn),
      fields: p.header.map((k, j) => ({ k, v: r[j] ?? "" })).filter((f) => f.v && !SECRET_COLUMNS.test(f.k)),
    };
  });

  // the catalog, for a category chip per course
  const cat = split(raw["קורסים"] ?? []);
  const catName = cat.header.indexOf("שם הקורס");
  const catCategory = cat.header.indexOf("קטגוריה");
  const categoryOf = new Map<string, string>();
  if (catName >= 0) for (const r of cat.rows) categoryOf.set(norm(r[catName] ?? ""), catCategory >= 0 ? (r[catCategory] ?? "") : "");

  const courseMap = new Map<string, CourseCount>();
  for (const x of participants) {
    const name = x.course.trim() || "בלי קורס";
    let cc = courseMap.get(name);
    if (!cc) {
      cc = { course: name, total: 0, byTrack: { frontal: 0, frontalLodging: 0, digital: 0, other: 0 }, category: categoryOf.get(norm(name)) ?? "" };
      courseMap.set(name, cc);
    }
    cc.total++;
    cc.byTrack[x.track]++;
  }
  const courses = [...courseMap.values()].sort((a, b) => b.total - a.total || a.course.localeCompare(b.course, "he"));

  const tracks = TRACKS.map((t) => ({ key: t.key, label: t.label, color: t.color, count: participants.filter((x) => x.track === t.key).length })).filter((t) => t.key !== "other" || t.count > 0);

  const companies = countBy(participants.map((x) => x.company));
  const rowsOf = (title: string) => split(raw[title] ?? []).rows.length;
  return {
    sheetTitle: meta.title,
    fetchedAt,
    participants,
    courses,
    tracks,
    companies: companies.map((x) => ({ company: x.key, count: x.count })),
    digitalCourses: countBy(participants.map((x) => x.digitalCourse)).map((x) => ({ course: x.key, count: x.count })),
    certCourses: countBy(participants.map((x) => x.certCourse)).map((x) => ({ course: x.key, count: x.count })),
    counts: {
      participants: participants.length,
      lodging: participants.filter((x) => x.lodging).length,
      privateRoom: participants.filter((x) => x.privateRoom).length,
      babies: participants.filter((x) => x.baby).length,
      laptopRentals: participants.filter((x) => x.laptopRental).length,
      cancellations: rowsOf("ביטולים"),
      day3: rowsOf("יום שלישי"),
      staff: rowsOf("צוות ומרצים"),
      companies: companies.length,
      coursesInCatalog: cat.rows.length,
    },
    missingTabs,
    participantsGid: meta.tabs.find((t) => t.title === "משתתפות")?.gid ?? null,
  };
}

/** The configured tabs joined with what the sheet has - the navigation and the index page. */
export async function hcTabIndex(): Promise<{ tab: TabDef; meta: SheetTabMeta | null }[]> {
  const meta = await hcTabsMeta();
  return TABS.map((tab) => ({ tab, meta: meta.tabs.find((t) => t.title === tab.title) ?? null }));
}
