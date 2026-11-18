import "server-only";
import { unstable_cache } from "next/cache";
import { readSheetsReadonly, sheetTabsMeta, SheetsError, type SheetTabMeta } from "@/lib/google-sheets";
import { DEFAULT_HC_SHEET_ID, P, PAID_ITEMS, SECRET_COLUMNS, SHEET_CACHE_SECONDS, TABS, TRACKS, trackKeyOf, yes, type DashRow, type NameRow, type PaidKey, type TabDef, type TrackKey } from "./config";

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

/* ---- the participants and the dashboard ---- */

export interface Participant extends DashRow {
  tag: string;
  digitalCourse: string;
  certCourse: string;
  office: string;
  city: string;
  price: string;
  paid: string;
  registeredOn: string;
  /** every filled cell, in the sheet's column order - the row's detail view */
  fields: { k: string; v: string }[];
}

export interface Snapshot {
  sheetTitle: string;
  fetchedAt: string;
  participants: Participant[];
  /** course name → category from the ״קורסים״ tab, when the names match */
  categoryByCourse: Record<string, string>;
  /** the distinct course names and companies, largest first - the table's filters */
  courseNames: string[];
  companyNames: string[];
  /** names behind the counts of the smaller tabs */
  extras: { cancellations: NameRow[]; day3: NameRow[]; staff: NameRow[] };
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

/** Names out of one of the smaller tabs: ״פרטי״ + ״משפחה״, with a line of context. */
function namesOf(values: string[][], subColumns: string[]): NameRow[] {
  const { header, rows } = split(values);
  const first = header.indexOf("פרטי");
  const last = header.indexOf("משפחה");
  const subs = subColumns.map((c) => header.indexOf(c)).filter((i) => i >= 0);
  return rows.map((r, i) => ({
    row: i + 2,
    name: `${first >= 0 ? r[first] : ""} ${last >= 0 ? r[last] : ""}`.trim() || `שורה ${i + 2}`,
    sub: subs
      .map((j) => r[j])
      .filter(Boolean)
      .join(" · "),
  }));
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
  const itemCols = PAID_ITEMS.map((it) => ({ key: it.key as PaidKey, chosen: col(it.chosen), paid: col(it.paid) }));

  const participants: Participant[] = p.rows.map((r, i) => {
    const trackLabel = cell(r, c.track);
    const items: Partial<Record<PaidKey, boolean>> = {};
    for (const it of itemCols) if (yes(cell(r, it.chosen))) items[it.key] = yes(cell(r, it.paid));
    return {
      row: i + 2,
      num: cell(r, c.num),
      name: `${cell(r, c.first)} ${cell(r, c.last)}`.trim(),
      company: cell(r, c.company),
      course: cell(r, c.course),
      track: trackKeyOf(trackLabel),
      trackLabel,
      role: cell(r, c.role),
      phone: cell(r, c.phone),
      mail: cell(r, c.mail) || cell(r, c.workMail),
      baby: yes(cell(r, c.baby)),
      laptopOwn: yes(cell(r, c.laptopOwn)),
      items,
      tag: cell(r, c.tag),
      digitalCourse: cell(r, c.digitalCourse),
      certCourse: cell(r, c.certCourse),
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
  const courseNames = countBy(participants.map((x) => x.course)).map((x) => x.key);
  const categoryByCourse: Record<string, string> = {};
  for (const name of courseNames) {
    const cg = categoryOf.get(norm(name));
    if (cg) categoryByCourse[name] = cg;
  }

  return {
    sheetTitle: meta.title,
    fetchedAt,
    participants,
    categoryByCourse,
    courseNames,
    companyNames: countBy(participants.map((x) => x.company)).map((x) => x.key),
    extras: {
      cancellations: namesOf(raw["ביטולים"] ?? [], ["חברה", "קורס"]),
      day3: namesOf(raw["יום שלישי"] ?? [], ["חברה", "משרד"]),
      staff: namesOf(raw["צוות ומרצים"] ?? [], ["תפקיד", "קורס"]),
    },
    missingTabs,
    participantsGid: meta.tabs.find((t) => t.title === "משתתפות")?.gid ?? null,
  };
}

/** The participants stripped to what the dashboard draws and lists. */
export function dashRowsOf(participants: Participant[]): DashRow[] {
  return participants.map(({ row, num, name, company, course, track, trackLabel, role, phone, mail, baby, laptopOwn, items }) => ({ row, num, name, company, course, track, trackLabel, role, phone, mail, baby, laptopOwn, items }));
}

/** The track colours, for anything server-side that needs them (the client imports TRACKS itself). */
export const trackColor = (key: TrackKey) => TRACKS.find((t) => t.key === key)?.color ?? "#B8C4CF";

/** The configured tabs joined with what the sheet has - the navigation and the index page. */
export async function hcTabIndex(): Promise<{ tab: TabDef; meta: SheetTabMeta | null }[]> {
  const meta = await hcTabsMeta();
  return TABS.map((tab) => ({ tab, meta: meta.tabs.find((t) => t.title === tab.title) ?? null }));
}
