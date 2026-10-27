import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { serviceAccountEmail } from "@/lib/drive-api";
import { readSheet, sheetTabs, SheetsError, writeCell } from "@/lib/google-sheets";
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
export const PRINTED_COLUMN = "הודפס";
/** The columns the desk shows and searches. Mails and phones never leave the server. */
export const DESK_COLUMNS = ["ת.ז.", "פרטי", "משפחה", "שם לתג", "תפקיד", "קורס", "משרד", "הודפס"] as const;
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

/** The browser entered the code (a cookie bound to the current code and sheet), or an admin is signed in. */
export async function hasTagsAccess(settings?: TagsSettings): Promise<boolean> {
  const s = settings ?? (await tagsSettings());
  if (!isConfigured(s)) return false;
  const c = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (c && c === cookieValueFor(s)) return true;
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

/** הודפס = כן on the row whose ת.ז. matches - what markPrintedByTz did in the Apps Script. */
export async function markPrinted(tz: string): Promise<{ ok: true } | SheetFailure> {
  const t = tz.trim();
  if (!t) return fail("bad_request", "חסר מספר ת.ז.");
  const s = await tagsSettings();
  if (!s.spreadsheetId) return fail("not_configured", "המערכת עוד לא חוברה לגיליון.");
  try {
    const rows = await readSheet(s.spreadsheetId, s.tab);
    const headers = trimmedHeaders(rows);
    const tzCol = headers.indexOf(TZ_COLUMN);
    const printedCol = headers.indexOf(PRINTED_COLUMN);
    if (tzCol < 0 || printedCol < 0) return fail("columns", `בגיליון חסרות העמודות ״${TZ_COLUMN}״ או ״${PRINTED_COLUMN}״.`);
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][tzCol] ?? "").trim() === t) {
        await writeCell(s.spreadsheetId, s.tab, i + 1, printedCol, "כן");
        return { ok: true };
      }
    }
    return fail("no_row", `לא נמצאה בגיליון שורה עם ת.ז. ${t}.`);
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
