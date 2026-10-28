import "server-only";
import { serviceAccountToken } from "@/lib/drive-api";

/*
  A minimal Google Sheets client over REST, as the Drive service account.
  Built for the Hightecourse tags screen (the owner, 27/10: the participants
  live in her Google Sheet; "לתת הרשאה לאקסל שיטס" - she shares the sheet with
  the service account instead of running an Apps Script behind a proxy).
  Needs the "Google Sheets API" enabled on the service account's Cloud project
  and the sheet shared with it as an editor; every other failure is reported
  with a hint the admin screen turns into a Hebrew instruction.
*/
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/** Overridable so a local check can point the client at a mock (SHEETS_API_BASE); real deployments never set it. */
function base(): string {
  return process.env.SHEETS_API_BASE || "https://sheets.googleapis.com";
}

export type SheetsHint = "no_credentials" | "api_disabled" | "not_shared" | "not_found" | "no_tab" | "unknown";

export class SheetsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly hint: SheetsHint
  ) {
    super(message);
  }
}

function hintFor(status: number, text: string): SheetsHint {
  if (status === 403 && /has not been used|is disabled|accessNotConfigured|SERVICE_DISABLED/i.test(text)) return "api_disabled";
  if (status === 403) return "not_shared";
  if (status === 404) return "not_found";
  if (status === 400 && /Unable to parse range/i.test(text)) return "no_tab";
  return "unknown";
}

async function sheetsFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token: string;
  try {
    token = await serviceAccountToken(SCOPE);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new SheetsError(msg, 0, msg === "drive_not_configured" ? "no_credentials" : "unknown");
  }
  return fetch(`${base()}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
}

async function body<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new SheetsError(`sheets_${res.status}: ${text.slice(0, 300)}`, res.status, hintFor(res.status, text));
  }
  return (await res.json()) as T;
}

function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

/** The tab titles of a spreadsheet - the cheapest "can we see it at all" call. */
export async function sheetTabs(spreadsheetId: string): Promise<string[]> {
  const j = await body<{ sheets?: { properties: { title: string } }[] }>(
    await sheetsFetch(`/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`)
  );
  return (j.sheets ?? []).map((s) => s.properties.title);
}

/** Every row of a tab as displayed strings (formatted values - a ת.ז. keeps its leading zero). */
export async function readSheet(spreadsheetId: string, tab: string): Promise<string[][]> {
  const j = await body<{ values?: unknown[][] }>(
    await sheetsFetch(`/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(quoteTab(tab))}?majorDimension=ROWS`)
  );
  return (j.values ?? []).map((row) => row.map((v) => (v === null || v === undefined ? "" : String(v))));
}

/** 0 -> A, 25 -> Z, 26 -> AA. */
export function columnLetter(index0: number): string {
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Appends one row under the tab's data (Sheets finds the table's end itself). */
export async function appendRow(spreadsheetId: string, tab: string, values: string[]): Promise<void> {
  await body(
    await sheetsFetch(`/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(quoteTab(tab))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ majorDimension: "ROWS", values: [values] }),
    })
  );
}

/** Writes one cell. `row1` is the 1-based sheet row, `col0` the 0-based column. */
export async function writeCell(spreadsheetId: string, tab: string, row1: number, col0: number, value: string): Promise<void> {
  const a1 = `${quoteTab(tab)}!${columnLetter(col0)}${row1}`;
  await body(
    await sheetsFetch(`/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(a1)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ range: a1, majorDimension: "ROWS", values: [[value]] }),
    })
  );
}
