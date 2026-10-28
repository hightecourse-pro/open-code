import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serviceAccountEmail } from "@/lib/drive-api";
import { appendRow, readSheet, sheetTabs, SheetsError, writeCell } from "@/lib/google-sheets";
import type { Json } from "@/types/database";
import type { Participant } from "./types";

/*
  מערכת הדפסת תגים of Hightecourse (the owner, 27/10: "צור כזה בצורה מדויקת
  אצלינו במערכת החיצונית עם ראוט מסוים") - the same screen her Bolt project had,
  on our domain at /tags. The participants stay in her Google Sheet (tab
  "משתתפות": ת.ז., פרטי, משפחה, שם לתג, מייל פרטי, מייל עבודה, נייד, תפקיד,
  קורס, משרד, חברה, הודפס); the list is read straight from it and a printed
  tag writes "כן" into הודפס, exactly what her Apps Script did. The sheet and
  the entry code are set in the Hightecourse admin (/ai-course/admin).
*/
export const TAGS_SETTINGS_KEY = "hightecourse_tags";
export const ACCESS_COOKIE = "hc_tags";
export const DEFAULT_TAB = "משתתפות";
export const TZ_COLUMN = "ת.ז.";
export const FIRST_COLUMN = "פרטי";
export const LAST_COLUMN = "משפחה";
export const OFFICE_COLUMN = "משרד";
export const PRINTED_COLUMN = "הודפס";
/** A walk-in the desk added (the owner, 28/10: ״יוסיף לאקסל עם אינדיקציה של חדש״) - the column is created on first use. */
export const NEW_COLUMN = "חדש";
/** When the tag was printed (the owner, 28/10: ״עמודה של תאריך ושעת ההדפסה״), Israel time - created on first use. */
export const PRINTED_AT_COLUMN = "תאריך ושעת ההדפסה";
/** The columns the desk shows and searches. Mails and phones never leave the server. */
export const DESK_COLUMNS = ["ת.ז.", "פרטי", "משפחה", "שם לתג", "תפקיד", "קורס", "משרד", "הודפס", "חדש", "תאריך ושעת ההדפסה"] as const;

/** ״28.10.2026 14:05״ - Israel time, as the sheet should read it. */
export function printStamp(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}
/** The Cloud project of the service account - where "Google Sheets API" has to be switched on (from Google's own 403 text). */
export const ENABLE_SHEETS_API_URL = "https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=263857418461";

export interface TagsSettings {
  spreadsheetId: string | null;
  tab: string;
  code: string | null;
}

export async function tagsSettings(): Promise<TagsSettings> {
  try {
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", TAGS_SETTINGS_KEY).maybeSingle();
    const v = (data?.value ?? {}) as { spreadsheet_id?: unknown; tab?: unknown; code?: unknown };
    const id = typeof v.spreadsheet_id === "string" ? v.spreadsheet_id.trim() : "";
    const tab = typeof v.tab === "string" && v.tab.trim() ? v.tab.trim() : DEFAULT_TAB;
    const code = typeof v.code === "string" ? v.code.trim() : "";
    return { spreadsheetId: id || null, tab, code: code || null };
  } catch {
    return { spreadsheetId: null, tab: DEFAULT_TAB, code: null };
  }
}

export function isConfigured(s: TagsSettings): s is TagsSettings & { spreadsheetId: string; code: string } {
  return !!s.spreadsheetId && !!s.code;
}

export async function saveTagsSettings(next: TagsSettings): Promise<void> {
  const { error } = await createAdminClient()
    .from("app_settings")
    .upsert({ key: TAGS_SETTINGS_KEY, value: { spreadsheet_id: next.spreadsheetId, tab: next.tab, code: next.code } as unknown as Json }, { onConflict: "key" });
  if (error) throw error;
}

/** A pasted sheet link, or a bare id. */
export function spreadsheetIdFrom(input: string): string | null {
  const m = input.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  const t = input.trim();
  return /^[A-Za-z0-9_-]{10,}$/.test(t) ? t : null;
}

export function sheetUrlOf(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

export function tagsServiceAccountEmail(): string | null {
  return serviceAccountEmail();
}

// ---- entry: the code from the settings, or a signed-in admin

function cookieValueFor(s: TagsSettings & { spreadsheetId: string; code: string }): string {
  return crypto.createHash("sha256").update(`${s.code}|${s.spreadsheetId}`).digest("hex");
}

/**
 * The browser entered the code (a cookie bound to the current code and sheet),
 * or an admin is signed in - she gets in as soon as a sheet is set, even before
 * a code exists (the owner, 27/10: she connected the sheet, left the code empty
 * and found the desk closed).
 */
export async function hasTagsAccess(settings?: TagsSettings): Promise<boolean> {
  const s = settings ?? (await tagsSettings());
  if (!s.spreadsheetId) return false;
  if (isConfigured(s)) {
    const c = (await cookies()).get(ACCESS_COOKIE)?.value;
    if (c && c === cookieValueFor(s)) return true;
  }
  const profile = await getProfile().catch(() => null);
  return profile?.role === "admin";
}

/** Route handlers only (a server component cannot set cookies). */
export async function enterWithCode(code: string): Promise<boolean> {
  const s = await tagsSettings();
  if (!isConfigured(s) || code.trim() !== s.code) return false;
  (await cookies()).set(ACCESS_COOKIE, cookieValueFor(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return true;
}

export async function leaveTags(): Promise<void> {
  (await cookies()).set(ACCESS_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

// ---- the sheet

export type SheetFailure = { ok: false; error: string; hint: string };

function fail(hint: string, error: string): SheetFailure {
  return { ok: false, error, hint };
}

/** Google's failure, as the instruction the person at the desk (or the admin) needs. */
export function failureOf(e: unknown, tab: string): SheetFailure {
  if (e instanceof SheetsError) {
    switch (e.hint) {
      case "no_credentials":
        return fail(e.hint, "חשבון השירות של גוגל לא מוגדר בסביבה הזו.");
      case "api_disabled":
        return fail(e.hint, "Google Sheets API עוד לא מופעל בפרויקט של חשבון השירות - צריך להפעיל אותו פעם אחת (הקישור בהגדרות) ולנסות שוב.");
      case "not_shared":
        return fail(e.hint, "לחשבון השירות אין גישה לגיליון - שתפי את הגיליון איתו כעורכת (הכתובת בהגדרות).");
      case "not_found":
        return fail(e.hint, "הגיליון לא נמצא - בדקי את הקישור בהגדרות.");
      case "no_tab":
        return fail(e.hint, `אין בגיליון לשונית בשם ״${tab}״.`);
      default:
        return fail(e.hint, `הקריאה לגוגל נכשלה - נסי שוב בעוד רגע. (${e.message.slice(0, 160)})`);
    }
  }
  return fail("unknown", `הקריאה לגוגל נכשלה - נסי שוב בעוד רגע. (${e instanceof Error ? e.message.slice(0, 160) : String(e)})`);
}

function trimmedHeaders(rows: string[][]): string[] {
  return (rows[0] ?? []).map((h) => h.trim());
}

/** Adds a header cell at the end of the header row when the column is not there yet; returns the headers as they are now. */
async function ensureColumn(spreadsheetId: string, tab: string, headers: string[], name: string): Promise<string[]> {
  if (headers.includes(name)) return headers;
  await writeCell(spreadsheetId, tab, 1, headers.length, name);
  return [...headers, name];
}

/** The sheet's rows as objects - the same shape the Apps Script returned, minus the private columns. */
export async function listParticipants(): Promise<{ ok: true; data: Participant[] } | SheetFailure> {
  const s = await tagsSettings();
  if (!s.spreadsheetId) return fail("not_configured", "המערכת עוד לא חוברה לגיליון.");
  try {
    const rows = await readSheet(s.spreadsheetId, s.tab);
    if (rows.length < 2) return { ok: true, data: [] };
    const headers = trimmedHeaders(rows);
    const wanted = new Set<string>(DESK_COLUMNS);
    const data: Participant[] = [];
    rows.slice(1).forEach((row, i) => {
      const o: Record<string, string> = {};
      let any = false;
      headers.forEach((h, idx) => {
        if (!wanted.has(h)) return;
        const v = (row[idx] ?? "").trim();
        o[h] = v;
        if (v) any = true;
      });
      if (any) data.push({ cols: o, row: i + 2 });
    });
    return { ok: true, data };
  } catch (e) {
    return failureOf(e, s.tab);
  }
}

export interface PrintedRef {
  tz?: string;
  /** Her 1-based sheet row as the list reported it. */
  row?: number;
  first?: string;
  last?: string;
}

/**
 * הודפס = כן on her row. The Apps Script found the row by ת.ז. only; a walk-in
 * added at the desk may have no ת.ז., so the row number the list handed out
 * is tried first (and must still carry her ת.ז. / names - the sheet may have
 * been re-sorted meanwhile), then ת.ז., then a unique first + last name.
 */
export async function markPrinted(ref: PrintedRef): Promise<{ ok: true } | SheetFailure> {
  const tz = (ref.tz ?? "").trim();
  const first = (ref.first ?? "").trim();
  const last = (ref.last ?? "").trim();
  if (!tz && !(first && last)) return fail("bad_request", "חסר מספר ת.ז. או שם.");
  const s = await tagsSettings();
  if (!s.spreadsheetId) return fail("not_configured", "המערכת עוד לא חוברה לגיליון.");
  try {
    const rows = await readSheet(s.spreadsheetId, s.tab);
    let headers = trimmedHeaders(rows);
    const tzCol = headers.indexOf(TZ_COLUMN);
    const firstCol = headers.indexOf(FIRST_COLUMN);
    const lastCol = headers.indexOf(LAST_COLUMN);
    const printedCol = headers.indexOf(PRINTED_COLUMN);
    if (printedCol < 0) return fail("columns", `בגיליון חסרה העמודה ״${PRINTED_COLUMN}״.`);
    const cell = (i: number, col: number) => (col >= 0 ? (rows[i]?.[col] ?? "").trim() : "");
    const sameNames = (i: number) => !!first && !!last && cell(i, firstCol) === first && cell(i, lastCol) === last;
    let target = -1;
    if (ref.row && ref.row >= 2 && ref.row <= rows.length) {
      const i = ref.row - 1;
      const tzOk = tz ? cell(i, tzCol) === tz : true;
      const namesOk = first && last ? sameNames(i) : true;
      if (tzOk && namesOk && (tz || (first && last))) target = i;
    }
    if (target < 0 && tz && tzCol >= 0) target = rows.findIndex((_, i) => i > 0 && cell(i, tzCol) === tz);
    if (target < 0 && first && last) {
      const hits = rows.map((_, i) => i).filter((i) => i > 0 && sameNames(i));
      if (hits.length === 1) target = hits[0];
    }
    if (target < 0) return fail("no_row", tz ? `לא נמצאה בגיליון שורה עם ת.ז. ${tz}.` : `לא נמצאה בגיליון שורה אחת ויחידה בשם ${first} ${last}.`);
    await writeCell(s.spreadsheetId, s.tab, target + 1, printedCol, "כן");
    headers = await ensureColumn(s.spreadsheetId, s.tab, headers, PRINTED_AT_COLUMN);
    await writeCell(s.spreadsheetId, s.tab, target + 1, headers.indexOf(PRINTED_AT_COLUMN), printStamp());
    return { ok: true };
  } catch (e) {
    return failureOf(e, s.tab);
  }
}

export interface WalkIn {
  first: string;
  last: string;
  office?: string;
  tz?: string;
}

/**
 * A name that is not in the sheet (the owner, 28/10: ״אפשרות להוסיף שם שלא
 * קיים (רק שם פרטי ומשפחה חובה) הוא ידפיס ויוסיף לאקסל עם אינדיקציה של חדש״):
 * appended as a new row, already הודפס = כן (the desk prints before it calls
 * this), with חדש = כן - the column is added to the header the first time.
 */
export async function addParticipant(input: WalkIn): Promise<{ ok: true; row: number } | SheetFailure> {
  const first = (input.first ?? "").trim();
  const last = (input.last ?? "").trim();
  const office = (input.office ?? "").trim();
  const tz = (input.tz ?? "").trim();
  if (!first || !last) return fail("bad_request", "שם פרטי ושם משפחה הם חובה.");
  if (tz && !/^\d{5,9}$/.test(tz)) return fail("bad_request", "ת.ז. צריכה להיות ספרות בלבד.");
  const s = await tagsSettings();
  if (!s.spreadsheetId) return fail("not_configured", "המערכת עוד לא חוברה לגיליון.");
  try {
    const rows = await readSheet(s.spreadsheetId, s.tab);
    let headers = trimmedHeaders(rows);
    const missing = [FIRST_COLUMN, LAST_COLUMN, PRINTED_COLUMN].filter((c) => !headers.includes(c));
    if (missing.length) return fail("columns", `בגיליון חסרות העמודות: ${missing.join(", ")}.`);
    headers = await ensureColumn(s.spreadsheetId, s.tab, headers, NEW_COLUMN);
    headers = await ensureColumn(s.spreadsheetId, s.tab, headers, PRINTED_AT_COLUMN);
    const values = headers.map(() => "");
    const set = (column: string, value: string) => {
      const i = headers.indexOf(column);
      if (i >= 0) values[i] = value;
    };
    set(TZ_COLUMN, tz);
    set(FIRST_COLUMN, first);
    set(LAST_COLUMN, last);
    set(OFFICE_COLUMN, office);
    set(PRINTED_COLUMN, "כן");
    set(NEW_COLUMN, "כן");
    set(PRINTED_AT_COLUMN, printStamp());
    await appendRow(s.spreadsheetId, s.tab, values);
    return { ok: true, row: rows.length + 1 };
  } catch (e) {
    return failureOf(e, s.tab);
  }
}

export type ConnectionReport = { ok: true; tabs: string[]; rows: number; headers: string[]; missing: string[] } | SheetFailure;

/** The admin's "בדיקת חיבור": can we see the sheet, is the tab there, are the two columns we write by present. */
export async function testConnection(): Promise<ConnectionReport> {
  const s = await tagsSettings();
  if (!s.spreadsheetId) return fail("not_configured", "עוד לא הוזן קישור לגיליון.");
  try {
    const tabs = await sheetTabs(s.spreadsheetId);
    if (!tabs.includes(s.tab)) return fail("no_tab", `הגיליון נפתח, אבל אין בו לשונית בשם ״${s.tab}״ (יש: ${tabs.join(", ")}).`);
    const rows = await readSheet(s.spreadsheetId, s.tab);
    const headers = trimmedHeaders(rows);
    const missing = [TZ_COLUMN, "פרטי", "משפחה", "משרד", PRINTED_COLUMN].filter((c) => !headers.includes(c));
    return { ok: true, tabs, rows: Math.max(0, rows.length - 1), headers, missing };
  } catch (e) {
    return failureOf(e, s.tab);
  }
}
