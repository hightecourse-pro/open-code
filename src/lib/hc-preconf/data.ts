import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSheetsReadonly, replaceTab } from "@/lib/google-sheets";
import { sendResendEmail, type MailAttachment } from "@/lib/email/resend";
import { isProductionEnv } from "@/lib/env";
import { getSiteUrl } from "@/lib/site";
import type { Database, Json } from "@/types/database";
import { P } from "@/app/hightecourse/config";
import { hcSheetId } from "@/app/hightecourse/data";
import { AI_TOOLS, CONF, DEV_TOOLS, KIND_LABEL, LICENSE_LABEL, TOOL_NONE, courseUpdateFor, kindNeedsLaptop, normCourse, prepFormPath, resolveCourse, type PrepAnswers, type PrepKind } from "./config";
import { buildCourseUpdateMail, buildPrepMail, type CourseUpdateInput, type PrepMailInput } from "./mail";

/*
  The server side of the pre-conference mail (the owner, 19/11): the frontal
  participants of HER sheet are copied into hc_preconf_participants, mailed
  once each, and mirrored - with their questionnaire answers - into a tab of
  the sheet (״שאלון הכנה 2026״). The tick runs every 30 minutes (pg_cron →
  /api/cron/hc-preconf) and from the admin screen; nothing goes out while
  the owner's switch is off. Outside production the mirror only writes when
  HC_PRECONF_SHEET_ID points at a test spreadsheet, and the mail gate keeps
  every real address safe (allowlist → ״blocked״, no retry).
*/
export type PrepRow = Database["public"]["Tables"]["hc_preconf_participants"]["Row"];
type PrepInsert = Database["public"]["Tables"]["hc_preconf_participants"]["Insert"];
export type PrepSettings = Database["public"]["Tables"]["hc_preconf_settings"]["Row"];
/** One switch per course for the update mail (the owner, 22/11). */
export type CourseUpdateRow = Database["public"]["Tables"]["hc_preconf_course_updates"]["Row"];

const T = "hc_preconf_participants";
const S = "hc_preconf_settings";
const CU = "hc_preconf_course_updates";
export const MIRROR_TAB = "שאלון הכנה 2026";
/** The earlier Google Form (״בחירת קורס פיתוח AI״) whose answers prefill ours. */
const PREFILL_SHEET = () => process.env.HC_PRECONF_PREFILL_SHEET_ID || "1ucaaDcZP9a-_r3MpoazwUCj_xJqQjVkOLGW4OmTBEyE";
const PREFILL_TAB = "תגובות לטופס 1";
/** Mails per tick: single sends (the program is attached, which the batch endpoint cannot do) at Resend's 2 a second, inside the function's time limit; the rest waits for the next tick. */
const SEND_LIMIT = 220;
const SEND_BUDGET_MS = 125_000;

export function mirrorSheetId(): string | null {
  const explicit = process.env.HC_PRECONF_SHEET_ID?.trim();
  if (explicit) return explicit;
  return isProductionEnv() ? hcSheetId() : null;
}

export function mirrorSheetUrl(): string | null {
  const id = mirrorSheetId();
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
}

const site = () => process.env.NEXT_PUBLIC_SITE_URL || getSiteUrl();
const yes = (v: string | null | undefined) => (v ?? "").trim() === "כן";
const validMail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/* ---- the sheet → rows ---- */

/** The first row with at least two filled cells is the header; `firstRow` is the 1-based sheet row of the first data row. */
function table(values: string[][]): { header: string[]; rows: string[][]; firstRow: number } {
  const trimmed = values.map((r) => r.map((v) => (v ?? "").trim()));
  let hi = trimmed.findIndex((r) => r.filter(Boolean).length >= 2);
  if (hi < 0) hi = 0;
  const header = trimmed[hi] ?? [];
  return { header, rows: trimmed.slice(hi + 1), firstRow: hi + 2 };
}

/** The frontal participants (every track but ״דיגיטלי״, as the 2025 script) as rows to upsert. */
async function readSheetParticipants(): Promise<PrepInsert[]> {
  const raw = await readSheetsReadonly(hcSheetId(), ["משתתפות", "קורסים"]);
  const cat = table(raw["קורסים"] ?? []);
  const catName = cat.header.indexOf("שם הקורס");
  const catLaptop = cat.header.indexOf("מחשב");
  const laptopByCourse = new Map<string, boolean>();
  if (catName >= 0 && catLaptop >= 0) for (const r of cat.rows) if (r[catName]) laptopByCourse.set(normCourse(r[catName]), yes(r[catLaptop]));
  const laptopOf = (course: string, kind: PrepKind): boolean => {
    const n = normCourse(course);
    if (laptopByCourse.has(n)) return laptopByCourse.get(n)!;
    for (const [k, v] of laptopByCourse) if (n.startsWith(k)) return v;
    return kindNeedsLaptop(kind);
  };

  const p = table(raw["משתתפות"] ?? []);
  const col = (name: string) => p.header.indexOf(name);
  const c = Object.fromEntries(Object.entries(P).map(([k, name]) => [k, col(name)])) as Record<keyof typeof P, number>;
  const updateCol = col("עדכון");
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "") : "");
  const out: PrepInsert[] = [];
  for (const [idx, r] of p.rows.entries()) {
    if (!r.some(Boolean)) continue;
    const sheetRow = p.firstRow + idx;
    const track = cell(r, c.track);
    if (track === "דיגיטלי") continue;
    const priv = cell(r, c.mail).toLowerCase();
    const work = cell(r, c.workMail).toLowerCase();
    const email = validMail(priv) ? priv : validMail(work) ? work : "";
    const other = email === priv ? work : priv;
    const cc = email && validMail(other) && other !== email ? other : null;
    const id = cell(r, c.id).replace(/\s+/g, "");
    const courseRaw = cell(r, c.course);
    const resolved = resolveCourse(courseRaw);
    const hold = resolved.hold ?? (email ? null : "אין כתובת מייל בגיליון");
    void resolved.note; // printed in the mail and the mirror from course_raw (mailInputOf / mirrorRowOf)
    out.push({
      source_key: id ? `tz:${id}` : email ? `mail:${email}` : `row:${sheetRow}`,
      is_sample: false,
      sheet_row: sheetRow,
      sheet_num: cell(r, c.num) || null,
      email,
      cc_email: cc,
      id_number: id || null,
      first_name: cell(r, c.first),
      last_name: cell(r, c.last),
      course_raw: courseRaw,
      course: resolved.course,
      course_kind: resolved.kind,
      laptop_required: resolved.kind === "unknown" ? laptopOf(courseRaw, resolved.kind) : laptopOf(resolved.course, resolved.kind),
      track: track || null,
      lodging: cell(r, c.lodging) || null,
      lodging_paid: cell(r, c.lodgingPaid) || null,
      private_room: cell(r, c.privateRoom) || null,
      private_room_paid: cell(r, c.privateRoomPaid) || null,
      baby: cell(r, c.baby) || null,
      baby_lodging: cell(r, c.babyLodging) || null,
      baby_lodging_paid: cell(r, c.babyLodgingPaid) || null,
      sitter_morning: cell(r, c.sitterMorning) || null,
      sitter_morning_paid: cell(r, c.sitterMorningPaid) || null,
      sitter_evening: cell(r, c.sitterEvening) || null,
      sitter_evening_paid: cell(r, c.sitterEveningPaid) || null,
      laptop_own: cell(r, c.laptopOwn) || null,
      laptop_rental: cell(r, c.laptopRental) || null,
      laptop_rental_paid: cell(r, c.laptopRentalPaid) || null,
      cert_course: cell(r, c.certCourse) || null,
      role_sheet: cell(r, c.role) || null,
      office_sheet: cell(r, c.office) || null,
      company: cell(r, c.company) || null,
      updated_personal: yes(cell(r, updateCol)),
      hold_reason: hold,
      removed_at: null,
      updated_at: new Date().toISOString(),
    });
  }
  // two sheet rows with the same key (a ת.ז. typed twice): the first wins, the other is reported through the admin's row count
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.source_key) ? false : (seen.add(x.source_key), true)));
}

export interface SyncResult {
  total: number;
  added: number;
  updated: number;
  removed: number;
  held: number;
}

/** The sheet's frontal participants into the table: newcomers added, snapshots refreshed, the gone marked. Never touches a token, a mail outcome or an answer. */
export async function syncFromSheet(): Promise<SyncResult> {
  const admin = createAdminClient();
  const fresh = await readSheetParticipants();
  const { data: existing, error } = await admin.from(T).select("source_key").eq("is_sample", false);
  if (error) throw new Error(`select: ${error.message}`);
  const have = new Set((existing ?? []).map((r) => r.source_key));
  const keys = new Set(fresh.map((r) => r.source_key));
  let added = 0;
  let updated = 0;
  for (let i = 0; i < fresh.length; i += 100) {
    const chunk = fresh.slice(i, i + 100);
    const { error: upErr } = await admin.from(T).upsert(chunk, { onConflict: "source_key" });
    if (upErr) throw new Error(`upsert: ${upErr.message}`);
    for (const r of chunk) {
      if (have.has(r.source_key)) updated++;
      else added++;
    }
  }
  const gone = [...have].filter((k) => !keys.has(k));
  let removed = 0;
  for (let i = 0; i < gone.length; i += 100) {
    const { data, error: rmErr } = await admin.from(T).update({ removed_at: new Date().toISOString() }).in("source_key", gone.slice(i, i + 100)).is("removed_at", null).select("id");
    if (rmErr) throw new Error(`remove: ${rmErr.message}`);
    removed += data?.length ?? 0;
  }
  return { total: fresh.length, added, updated, removed, held: fresh.filter((r) => r.hold_reason).length };
}

/* ---- the prefill from the earlier Google Form ---- */

/** The free text of ״איזה כלי AI?״ into our checkboxes; what matches nothing stays as ״אחר״. */
export function parseTools(text: string, kind: PrepKind): { tools: string[]; other: string } {
  const t = (text ?? "").trim();
  if (!t) return { tools: [], other: "" };
  const low = t.toLowerCase();
  const tools: string[] = [];
  const rules: [RegExp, string][] = [
    [/claude\s*code|קלוד\s*קוד/, "Claude Code"],
    [/kiro|קירו/, "Kiro"],
    [/amazon\s*q/, "Amazon Q"],
    [/copilot|קופיילוט/, "GitHub Copilot"],
    [/cursor|קרסור/, "Cursor"],
    [/gemini|ג'מיני|ג׳מיני/, "Gemini"],
    [/chat\s*gpt|gpt|צ'אט|צ׳אט/, "ChatGPT"],
  ];
  for (const [re, name] of rules) if (re.test(low)) tools.push(name);
  // a bare "claude" - the coding tool in a developers' course, the assistant elsewhere
  if (/(^|[^a-z])claude($|[^a-z])|קלוד/.test(low) && !/claude\s*code|קלוד\s*קוד/.test(low)) tools.push(kind === "dev" ? "Claude Code" : "Claude");
  const unique = [...new Set(tools)];
  const allowed = new Set<string>(kind === "dev" ? DEV_TOOLS : AI_TOOLS);
  const kept = unique.filter((x) => allowed.has(x));
  const other = kept.length === unique.length && kept.length > 0 ? "" : t;
  return { tools: kept, other: kept.length === 0 ? t : other && unique.length > kept.length ? t : "" };
}

interface PrefillRecord extends PrepAnswers {
  source: string;
  at: string;
}

async function readPrefill(): Promise<Map<string, { office: string; role: string; laptop: string; hasTools: string; which: string; at: string }>> {
  const vals = (await readSheetsReadonly(PREFILL_SHEET(), [PREFILL_TAB]))[PREFILL_TAB] ?? [];
  const { header, rows } = table(vals);
  const find = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iMail1 = find(/^כתובת אימייל/);
  const iMail2 = find(/^כתובת מייל/);
  const iOffice = find(/^משרד/);
  const iRole = find(/^תפקיד/);
  const iLaptop = find(/מחשב נייד/);
  const iHas = find(/^האם יש לך כלי AI/);
  const iWhich = find(/איזה כלי/);
  const iAt = find(/חותמת זמן/);
  const out = new Map<string, { office: string; role: string; laptop: string; hasTools: string; which: string; at: string }>();
  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "") : "");
  for (const r of rows) {
    const rec = { office: cell(r, iOffice), role: cell(r, iRole), laptop: cell(r, iLaptop), hasTools: cell(r, iHas), which: cell(r, iWhich), at: cell(r, iAt) };
    for (const i of [iMail1, iMail2]) {
      const m = cell(r, i).toLowerCase();
      if (validMail(m)) out.set(m, rec); // a later answer of the same woman wins
    }
  }
  return out;
}

/** What the earlier form knew, onto every row that has not answered ours yet. Returns how many rows got a prefill. */
export async function refreshPrefill(): Promise<number> {
  const admin = createAdminClient();
  const byMail = await readPrefill();
  if (byMail.size === 0) return 0;
  const { data: rows, error } = await admin.from(T).select("id, email, cc_email, course_kind, prefill").eq("is_sample", false).is("answers", null);
  if (error) throw new Error(`prefill select: ${error.message}`);
  let n = 0;
  for (const r of rows ?? []) {
    const rec = byMail.get(r.email) ?? (r.cc_email ? byMail.get(r.cc_email) : undefined);
    if (!rec) continue;
    const kind = r.course_kind as PrepKind;
    const laptop = /^כן/.test(rec.laptop) ? "yes" : /^לא/.test(rec.laptop) ? "no" : undefined;
    const parsed = parseTools(rec.which, kind);
    const none = /^לא/.test(rec.hasTools) && parsed.tools.length === 0;
    const prefill: PrefillRecord = {
      source: "בחירת קורס פיתוח AI",
      at: rec.at,
      ...(rec.role ? { role: rec.role } : {}),
      ...(rec.office ? { office: rec.office } : {}),
      ...(laptop ? { laptop } : {}),
      ...(none ? { tools: [TOOL_NONE] } : parsed.tools.length ? { tools: parsed.tools } : {}),
      ...(parsed.other ? { toolsOther: parsed.other } : {}),
    };
    if (JSON.stringify(prefill) === JSON.stringify(r.prefill)) continue;
    const { error: upErr } = await admin.from(T).update({ prefill: prefill as unknown as Json }).eq("id", r.id);
    if (!upErr) n++;
  }
  return n;
}

/* ---- the mail ---- */

export function mailInputOf(row: PrepRow): PrepMailInput {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    idNumber: row.id_number ?? "",
    course: row.course || row.course_raw,
    courseNote: resolveCourse(row.course_raw).note ?? "",
    kind: row.course_kind as PrepKind,
    laptopRequired: row.laptop_required,
    lodging: row.lodging ?? "",
    lodgingPaid: row.lodging_paid ?? "",
    certCourse: row.cert_course ?? "",
    laptopRental: row.laptop_rental ?? "",
    laptopRentalPaid: row.laptop_rental_paid ?? "",
    sitterMorning: row.sitter_morning ?? "",
    sitterEvening: row.sitter_evening ?? "",
    sitterMorningPaid: row.sitter_morning_paid ?? "",
    sitterEveningPaid: row.sitter_evening_paid ?? "",
    updatedPersonal: row.updated_personal,
    formUrl: `${site()}${prepFormPath(row.token)}`,
    siteUrl: site(),
    programUrl: `${site()}${CONF.programPath}`,
  };
}

export const mailOf = (row: PrepRow) => buildPrepMail(mailInputOf(row));

/* ---- the per-course update mail (the owner, 22/11: ״צריך לשלוח לכל קורס עדכון על הכלים הנדרשים לקורס״) ---- */

const UNPAID: [keyof PrepRow, keyof PrepRow, string][] = [
  ["lodging", "lodging_paid", "הלינה במלון"],
  ["private_room", "private_room_paid", "החדר הפרטי"],
  ["baby_lodging", "baby_lodging_paid", "לינת התינוק"],
  ["sitter_morning", "sitter_morning_paid", "השמרטפיה בבוקר"],
  ["sitter_evening", "sitter_evening_paid", "השמרטפיה בערב"],
  ["laptop_rental", "laptop_rental_paid", "השכרת המחשב"],
];
/** What she chose in the sheet (כן) and whose payment column says לא - as the mail names them. */
export const unpaidOf = (row: PrepRow): string[] => UNPAID.filter(([a, b]) => yes(row[a] as string | null) && (String(row[b] ?? "")).trim() === "לא").map(([, , label]) => label);

/** The update mail's input for her row - null when her course has no text yet. */
export function courseUpdateInputOf(row: PrepRow): CourseUpdateInput | null {
  const text = courseUpdateFor(row.course);
  if (!text) return null;
  const a = answersOf(row);
  return {
    firstName: row.first_name,
    course: text.course,
    kind: row.course_kind as PrepKind,
    laptopRequired: row.laptop_required,
    lines: text.lines,
    installs: text.installs ?? null,
    after: text.after ?? [],
    doc: text.doc ? { title: text.doc.title, text: text.doc.text, url: `${site()}${text.doc.path}`, linkText: text.doc.linkText } : null,
    laptopOwn: row.laptop_own ?? "",
    laptopRental: row.laptop_rental ?? "",
    laptopRentalPaid: row.laptop_rental_paid ?? "",
    answered: !!row.answered_at,
    answerLaptop: a.laptop,
    noTools: (a.tools ?? []).includes(TOOL_NONE),
    updatedPersonal: row.updated_personal,
    unpaid: unpaidOf(row),
    formUrl: `${site()}${prepFormPath(row.token)}`,
    siteUrl: site(),
  };
}

export const courseUpdateMailOf = (row: PrepRow): { subject: string; html: string } | null => {
  const i = courseUpdateInputOf(row);
  return i ? buildCourseUpdateMail(i) : null;
};

/** Both her addresses (the owner: ״לשלוח יחד ל-2 המיילים של המשתתפת״). */
const recipientsOf = (row: Pick<PrepRow, "email" | "cc_email">): string[] => [row.email, row.cc_email ?? ""].filter((a) => !!a);

const attachmentCache = new Map<string, { at: number; attachment: MailAttachment }>();
/** A file from our own site (/public), base64 for Resend - fetched once per ten minutes. */
async function siteAttachment(path: string, filename: string): Promise<MailAttachment> {
  const hit = attachmentCache.get(path);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.attachment;
  const res = await fetch(`${site()}${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`attachment ${path} ${res.status}`);
  const content = Buffer.from(await res.arrayBuffer()).toString("base64");
  const attachment = { filename, content };
  attachmentCache.set(path, { at: Date.now(), attachment });
  return attachment;
}
/** The program image (the owner: ״התוכניה מצורפת כאן״). */
export const programAttachment = (): Promise<MailAttachment> => siteAttachment(CONF.programPath, CONF.programFileName);
/** The course's document on its update mail (Vibe Coding: the product document), when it has one. */
async function courseUpdateAttachments(course: string): Promise<MailAttachment[]> {
  const doc = courseUpdateFor(course)?.doc;
  return doc ? [await siteAttachment(doc.path, doc.fileName)] : [];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SendResult {
  sent: number;
  blocked: number;
  errors: number;
  firstError?: string;
}

/** Everyone free to mail and not yet mailed (an error is retried twice) - one send each, both her addresses, the program attached. */
export async function sendPending(deadline: number = Date.now() + SEND_BUDGET_MS): Promise<SendResult> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from(T)
    .select("*")
    .eq("is_sample", false)
    .is("hold_reason", null)
    .is("removed_at", null)
    .neq("email", "")
    .or("mail_status.is.null,and(mail_status.eq.error,mail_attempts.lt.3)")
    .order("sheet_row", { ascending: true })
    .limit(SEND_LIMIT);
  if (error) throw new Error(`send select: ${error.message}`);
  const list = rows ?? [];
  const result: SendResult = { sent: 0, blocked: 0, errors: 0 };
  if (list.length === 0) return result;
  const attachments = [await programAttachment()];
  for (const r of list) {
    if (Date.now() > deadline) break; // the next tick continues
    const m = mailOf(r);
    const o = await sendResendEmail({ to: recipientsOf(r), subject: m.subject, html: m.html, attachments, essential: true, fromName: CONF.fromName, replyTo: CONF.replyTo });
    const status = o.ok ? "sent" : o.error === "blocked_by_allowlist" ? "blocked" : "error";
    if (status === "sent") result.sent++;
    else if (status === "blocked") result.blocked++;
    else {
      result.errors++;
      result.firstError ??= o.error;
    }
    const now = new Date().toISOString();
    await admin
      .from(T)
      .update({ mail_status: status, mail_sent_at: o.ok ? now : r.mail_sent_at, mail_error: o.ok ? null : (o.error ?? null), mail_attempts: r.mail_attempts + 1, updated_at: now })
      .eq("id", r.id);
    await sleep(520); // Resend: 2 requests a second
  }
  return result;
}

export type CourseSendResult = SendResult & { courses: number };

const updateOutcome = (ok: boolean, error?: string) => (ok ? "sent" : error === "blocked_by_allowlist" ? "blocked" : "error");

/**
 * The update mail to everyone in a course the owner switched on who has not got it yet (an error is retried twice):
 * whoever registers later gets it from a later tick (the owner, 22/11: ״כל מייל שכבר נשלח יישלח לכל הרישומים
 * לקורס זה מאוחר יותר״). Single sends, both her addresses, no attachment.
 */
export async function sendCourseUpdatesPending(deadline: number = Date.now() + SEND_BUDGET_MS): Promise<CourseSendResult> {
  const admin = createAdminClient();
  const { data: on, error: cuErr } = await admin.from(CU).select("course").eq("enabled", true);
  if (cuErr) throw new Error(`course updates: ${cuErr.message}`);
  const courses = (on ?? []).map((c) => c.course).filter((c) => !!courseUpdateFor(c));
  const result: CourseSendResult = { sent: 0, blocked: 0, errors: 0, courses: courses.length };
  if (courses.length === 0) return result;
  const { data: rows, error } = await admin
    .from(T)
    .select("*")
    .eq("is_sample", false)
    .is("hold_reason", null)
    .is("removed_at", null)
    .neq("email", "")
    .in("course", courses)
    .or("update_mail_status.is.null,and(update_mail_status.eq.error,update_mail_attempts.lt.3)")
    .order("sheet_row", { ascending: true })
    .limit(SEND_LIMIT);
  if (error) throw new Error(`update send select: ${error.message}`);
  for (const r of rows ?? []) {
    if (Date.now() > deadline) break; // the next tick continues
    const m = courseUpdateMailOf(r);
    if (!m) continue;
    let attachments: MailAttachment[];
    try {
      attachments = await courseUpdateAttachments(r.course);
    } catch (e) {
      result.errors++;
      result.firstError ??= e instanceof Error ? e.message : String(e);
      continue; // the file is missing on the site - nobody in that course is marked, the next tick retries
    }
    const o = await sendResendEmail({ to: recipientsOf(r), subject: m.subject, html: m.html, attachments, essential: true, fromName: CONF.fromName, replyTo: CONF.replyTo });
    const status = updateOutcome(o.ok, o.error);
    if (status === "sent") result.sent++;
    else if (status === "blocked") result.blocked++;
    else {
      result.errors++;
      result.firstError ??= o.error;
    }
    const now = new Date().toISOString();
    await admin
      .from(T)
      .update({ update_mail_status: status, update_mail_sent_at: o.ok ? now : r.update_mail_sent_at, update_mail_error: o.ok ? null : (o.error ?? null), update_mail_attempts: r.update_mail_attempts + 1, updated_at: now })
      .eq("id", r.id);
    await sleep(520); // Resend: 2 requests a second
  }
  return result;
}

/** The per-course switches (every course that has a row). */
export async function loadCourseUpdates(): Promise<CourseUpdateRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.from(CU).select("*").order("course", { ascending: true });
  return data ?? [];
}

/** The owner approved (or stopped) a course's update mail. Only a course with a text can be switched on. */
export async function setCourseUpdateEnabled(course: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const text = courseUpdateFor(course);
  if (!text) return { ok: false, error: "no_text" };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from(CU).upsert({ course: text.course, enabled, enabled_at: enabled ? now : null, updated_at: now }, { onConflict: "course" });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** One participant's update mail again (the admin's ״לשלוח שוב את העדכון״). */
export async function resendCourseUpdate(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: row } = await admin.from(T).select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  if (!row.email) return { ok: false, error: "no_email" };
  const m = courseUpdateMailOf(row);
  if (!m) return { ok: false, error: "no_text" };
  let attachments: MailAttachment[];
  try {
    attachments = await courseUpdateAttachments(row.course);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const r = await sendResendEmail({ to: recipientsOf(row), subject: m.subject, html: m.html, attachments, essential: true, fromName: CONF.fromName, replyTo: CONF.replyTo });
  const now = new Date().toISOString();
  await admin
    .from(T)
    .update({ update_mail_status: updateOutcome(r.ok, r.error), update_mail_sent_at: r.ok ? now : row.update_mail_sent_at, update_mail_error: r.ok ? null : (r.error ?? "send_failed"), update_mail_attempts: row.update_mail_attempts + 1, updated_at: now })
    .eq("id", id);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** The update mail's variations for one course (the owner, 22/11: ״תשלח לי דוגמא וכשאאשר תשלח לכל הקבוצה״). */
const UPDATE_SAMPLES: { n: string; label: string; row: Partial<PrepInsert>; answers: PrepAnswers | null }[] = [
  { n: "א", label: "לא מילאה את הטופס, לא עדכנה אזור אישי, הלינה לא שולמה", row: { lodging: "כן", lodging_paid: "לא", updated_personal: false }, answers: null },
  { n: "ב", label: "מילאה: עם מחשב, Gemini מהעבודה; עדכנה, הכול שולם", row: { lodging: "כן", lodging_paid: "כן", laptop_own: "כן", updated_personal: true }, answers: { role: "מנתחת מערכות", laptop: "yes", tools: ["Gemini"], license: "work" } },
  { n: "ג", label: "מילאה: בלי מחשב ולא השכירה, בלי כלי AI; עדכנה", row: { lodging: "לא", updated_personal: true }, answers: { role: "מנהלת פרויקטים", laptop: "no", tools: [TOOL_NONE] } },
  { n: "ד", label: "מילאה: הזמינה מחשב מהשכרה (שולם); עדכנה", row: { lodging: "לא", laptop_rental: "כן", laptop_rental_paid: "כן", updated_personal: true }, answers: { role: "מפתחת", laptop: "no", tools: ["Cursor"], license: "private" } },
];

export async function sendCourseUpdateSamples(to: string, course: string): Promise<{ n: string; label: string; ok: boolean; error?: string }[]> {
  const text = courseUpdateFor(course);
  if (!text) return UPDATE_SAMPLES.map((x) => ({ n: x.n, label: x.label, ok: false, error: "no_text" }));
  const admin = createAdminClient();
  const resolved = resolveCourse(text.course);
  const out: { n: string; label: string; ok: boolean; error?: string }[] = [];
  let attachments: MailAttachment[] = [];
  try {
    attachments = await courseUpdateAttachments(text.course);
  } catch (e) {
    return UPDATE_SAMPLES.map((x) => ({ n: x.n, label: x.label, ok: false, error: `attachment: ${e instanceof Error ? e.message : String(e)}` }));
  }
  for (const [idx, x] of UPDATE_SAMPLES.entries()) {
    const now = new Date().toISOString();
    const base: PrepInsert = {
      source_key: `usample:${idx + 1}`,
      is_sample: true,
      email: to.trim().toLowerCase(),
      first_name: "דוגמה",
      last_name: x.n,
      id_number: "123456789",
      course_raw: text.course,
      course: resolved.course,
      course_kind: resolved.kind,
      laptop_required: kindNeedsLaptop(resolved.kind),
      track: x.row.lodging === "כן" ? "פרונטלי כולל לינה" : "פרונטלי ללא לינה",
      role_sheet: "מנתחת מערכות",
      office_sheet: "משרד לדוגמה",
      answers: (x.answers as unknown as Json) ?? null,
      answered_at: x.answers ? now : null,
      updated_at: now,
      ...x.row,
    };
    const { data: row, error } = await admin.from(T).upsert(base, { onConflict: "source_key" }).select("*").maybeSingle();
    if (error || !row) {
      out.push({ n: x.n, label: x.label, ok: false, error: error?.message ?? "upsert" });
      continue;
    }
    const m = courseUpdateMailOf(row);
    if (!m) {
      out.push({ n: x.n, label: x.label, ok: false, error: "no_text" });
      continue;
    }
    const r = await sendResendEmail({ to: row.email, subject: `[דוגמה ${x.n}: ${x.label}] ${m.subject}`, html: m.html, attachments, essential: true, fromName: CONF.fromName, replyTo: CONF.replyTo });
    await sleep(520);
    await admin
      .from(T)
      .update({ update_mail_status: updateOutcome(r.ok, r.error), update_mail_sent_at: r.ok ? new Date().toISOString() : null, update_mail_error: r.ok ? null : (r.error ?? null), update_mail_attempts: row.update_mail_attempts + 1 })
      .eq("id", row.id);
    out.push({ n: x.n, label: x.label, ok: r.ok, error: r.error });
  }
  return out;
}

/** One participant again (the admin's ״לשלוח שוב״) - a single send, whatever her status. */
export async function resendPrepMail(id: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: row } = await admin.from(T).select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "not_found" };
  if (!row.email) return { ok: false, error: "no_email" };
  const m = mailOf(row);
  const r = await sendResendEmail({ to: recipientsOf(row), subject: m.subject, html: m.html, attachments: [await programAttachment()], essential: true, fromName: CONF.fromName, replyTo: CONF.replyTo });
  const now = new Date().toISOString();
  await admin
    .from(T)
    .update({ mail_status: r.ok ? "sent" : r.error === "blocked_by_allowlist" ? "blocked" : "error", mail_sent_at: r.ok ? now : row.mail_sent_at, mail_error: r.ok ? null : (r.error ?? "send_failed"), mail_attempts: row.mail_attempts + 1, updated_at: now })
    .eq("id", id);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/* ---- the samples (the owner, 19/11: ״שלח לי דוגמאות מייצגות למייל שלי מכל מיני וריאציות״) ---- */

const SAMPLES: { n: number; label: string; row: Partial<PrepInsert> }[] = [
  { n: 1, label: "פיתוח, לינה, שמרטפיה, לא עדכנה", row: { course_raw: "Vibe Coding - פיתוח מקצה לקצה באמצעות כלי AI", lodging: "כן", lodging_paid: "כן", sitter_morning: "כן", sitter_morning_paid: "כן", sitter_evening: "כן", sitter_evening_paid: "לא", baby: "כן", updated_personal: false } },
  { n: 2, label: "AI, בלי לינה, מחשב מהשכרה שולם, עדכנה", row: { course_raw: "AI מתקדם למנהלים ומנתחי מערכות", lodging: "לא", laptop_rental: "כן", laptop_rental_paid: "כן", updated_personal: true } },
  { n: 3, label: "מתקדם מאוד (בלי מחשב), לינה לא שולמה", row: { course_raw: "Advanced GenAI & Agentic AI for Developers - מתקדם מאוד", lodging: "כן", lodging_paid: "לא", updated_personal: true } },
  { n: 4, label: "מיומנויות רכות, תעודה דיגיטלית, לא עדכנה", row: { course_raw: "מיומנויות רכות בעולם העבודה החדש", lodging: "לא", cert_course: "ניהול מוצר - דיגיטלי בלבד", updated_personal: false } },
  { n: 5, label: "מצוינות בניהול, לינה, עדכנה", row: { course_raw: "מצויינות בניהול", lodging: "כן", lodging_paid: "כן", updated_personal: true } },
  { n: 6, label: "Salesforce, מחשב מהשכרה לא שולם, לא עדכנה", row: { course_raw: "יישום ופיתוח Salesforce בעידן ה־AI", lodging: "לא", laptop_rental: "כן", laptop_rental_paid: "לא", updated_personal: false } },
  { n: 7, label: "מצוינות בניהול - נדרש אישור חברה, עדכנה", row: { course_raw: "מצויינות בניהול - נדרש אישור חברה למעבר", lodging: "לא", updated_personal: true } },
  { n: 8, label: "קורס עוד לא נבחר (בסיסי או מתקדם), לינה", row: { course_raw: "Advanced GenAI & Agentic AI for Developers - נדרש לבחור בסיסי או מתקדם", lodging: "כן", lodging_paid: "כן", updated_personal: false } },
  { n: 9, label: "Advanced GenAI מהבסיס - רשימת התקנה, מחשב משלה, עדכנה", row: { course_raw: "Advanced GenAI & Agentic AI for Developers - מהבסיס כולל תרגול", lodging: "לא", laptop_own: "כן", updated_personal: true } },
];

/** The variations to one address, each a real row (is_sample) so the questionnaire links in them work. */
export async function sendPrepSamples(to: string): Promise<{ n: number; label: string; ok: boolean; error?: string }[]> {
  const admin = createAdminClient();
  const out: { n: number; label: string; ok: boolean; error?: string }[] = [];
  let attachments: MailAttachment[] = [];
  try {
    attachments = [await programAttachment()];
  } catch (e) {
    return SAMPLES.map((s) => ({ n: s.n, label: s.label, ok: false, error: `program: ${e instanceof Error ? e.message : String(e)}` }));
  }
  for (const s of SAMPLES) {
    const resolved = resolveCourse(s.row.course_raw ?? "");
    const base: PrepInsert = {
      source_key: `sample:${s.n}`,
      is_sample: true,
      email: to.trim().toLowerCase(),
      first_name: "דוגמה",
      last_name: `${s.n}`,
      id_number: "123456789",
      course: resolved.course,
      course_kind: resolved.kind,
      laptop_required: kindNeedsLaptop(resolved.kind),
      track: s.row.lodging === "כן" ? "פרונטלי כולל לינה" : "פרונטלי ללא לינה",
      role_sheet: "מפתחת",
      office_sheet: "משרד לדוגמה",
      updated_at: new Date().toISOString(),
      ...s.row,
    };
    const { data: row, error } = await admin.from(T).upsert(base, { onConflict: "source_key" }).select("*").maybeSingle();
    if (error || !row) {
      out.push({ n: s.n, label: s.label, ok: false, error: error?.message ?? "upsert" });
      continue;
    }
    const m = mailOf(row);
    const r = await sendResendEmail({ to: row.email, subject: `[דוגמה ${s.n}: ${s.label}] ${m.subject}`, html: m.html, attachments, essential: true, fromName: CONF.fromName, replyTo: CONF.replyTo });
    await sleep(520);
    await admin
      .from(T)
      .update({ mail_status: r.ok ? "sent" : r.error === "blocked_by_allowlist" ? "blocked" : "error", mail_sent_at: r.ok ? new Date().toISOString() : null, mail_error: r.ok ? null : (r.error ?? null), mail_attempts: row.mail_attempts + 1 })
      .eq("id", row.id);
    out.push({ n: s.n, label: s.label, ok: r.ok, error: r.error });
  }
  return out;
}

/* ---- the mirror into the owner's sheet ---- */

const fmt = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const when = (iso: string | null) => (iso ? fmt.format(new Date(iso)) : "");
const yn = (b: boolean | null | undefined) => (b ? "כן" : "לא");

export const MIRROR_HEADER = [
  "מס בגיליון",
  "שם פרטי",
  "שם משפחה",
  "מייל",
  "מייל נוסף",
  "חברה",
  "קורס",
  "הערה מהגיליון",
  "סוג שאלון",
  "נדרש מחשב",
  "מסלול",
  "לינה",
  "שמרטפיה",
  "עדכנה אזור אישי",
  "סטטוס מייל",
  "מייל נשלח",
  "מילאה שאלון",
  "תפקיד",
  "משרד",
  "מגיעה עם מחשב",
  "כלי AI",
  "כלי אחר",
  "רישיון",
  "תפקיד ניהולי",
  "עובדים מתחתיה",
  "שנות ניסיון",
  "הערה",
  "מילוי מוקדם מהטופס הקודם",
  "סיבת המתנה",
  "מייל עדכון לקורס",
  "עדכון לקורס נשלח",
  "קישור לשאלון",
] as const;

const MAIL_STATUS_HE: Record<string, string> = { sent: "נשלח", blocked: "נחסם (סביבת בדיקה)", error: "שגיאה" };

export function answersOf(row: Pick<PrepRow, "answers">): PrepAnswers {
  return ((row.answers as PrepAnswers | null) ?? {}) as PrepAnswers;
}

/** The merged starting point of her form: our answers, else the earlier form's, else the sheet's role and office. */
export function initialAnswersOf(row: Pick<PrepRow, "answers" | "prefill" | "role_sheet" | "office_sheet">): PrepAnswers {
  const prefill = (row.prefill as PrefillRecord | null) ?? null;
  const a = answersOf(row);
  return {
    role: a.role ?? prefill?.role ?? row.role_sheet ?? "",
    office: a.office ?? prefill?.office ?? row.office_sheet ?? "",
    laptop: a.laptop ?? prefill?.laptop,
    tools: a.tools ?? prefill?.tools ?? [],
    toolsOther: a.toolsOther ?? prefill?.toolsOther ?? "",
    license: a.license ?? "",
    mgmtRole: a.mgmtRole ?? "",
    employees: a.employees ?? "",
    years: a.years ?? "",
    note: a.note ?? "",
  };
}

export function mirrorRowOf(row: PrepRow): string[] {
  const a = answersOf(row);
  const sitter = [yes(row.sitter_morning) ? "בוקר" : "", yes(row.sitter_evening) ? "ערב" : ""].filter(Boolean).join(" + ");
  const prefill = row.prefill as PrefillRecord | null;
  return [
    row.sheet_num ?? "",
    row.first_name,
    row.last_name,
    row.email,
    row.cc_email ?? "",
    row.company ?? "",
    row.course || row.course_raw,
    resolveCourse(row.course_raw).note ?? "",
    KIND_LABEL[(row.course_kind as PrepKind) ?? "unknown"] ?? row.course_kind,
    yn(row.laptop_required),
    row.track ?? "",
    row.lodging ?? "",
    sitter,
    yn(row.updated_personal),
    row.removed_at ? "הוסרה מהגיליון" : row.mail_status ? (MAIL_STATUS_HE[row.mail_status] ?? row.mail_status) : row.hold_reason ? "ממתינה" : "טרם נשלח",
    when(row.mail_sent_at),
    when(row.answered_at),
    a.role ?? "",
    a.office ?? "",
    a.laptop === "yes" ? "כן" : a.laptop === "no" ? "לא" : "",
    (a.tools ?? []).join(", "),
    a.toolsOther ?? "",
    a.license ? LICENSE_LABEL[a.license] : "",
    a.mgmtRole ?? "",
    a.employees ?? "",
    a.years ?? "",
    a.note ?? "",
    prefill ? `${prefill.source}${prefill.at ? ` (${prefill.at})` : ""}` : "",
    row.hold_reason ?? "",
    row.update_mail_status ? (MAIL_STATUS_HE[row.update_mail_status] ?? row.update_mail_status) : courseUpdateFor(row.course) ? "טרם נשלח" : "",
    when(row.update_mail_sent_at),
    `${site()}${prepFormPath(row.token)}`,
  ];
}

/** The whole table into the tab (the owner's sheet in production, a test spreadsheet on staging, nowhere else). */
export async function mirrorToSheet(): Promise<{ rows: number } | { skipped: string }> {
  const sheetId = mirrorSheetId();
  if (!sheetId) return { skipped: "no_sheet" };
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from(T).select("*").eq("is_sample", false).order("sheet_row", { ascending: true });
  if (error) throw new Error(`mirror select: ${error.message}`);
  const list = (rows ?? []).filter((r) => !r.removed_at);
  await replaceTab(sheetId, MIRROR_TAB, [[...MIRROR_HEADER], ...list.map(mirrorRowOf)]);
  return { rows: list.length };
}

/* ---- the tick ---- */

export interface TickResult {
  ok: boolean;
  at: string;
  trigger: string;
  skipped?: string;
  enabled?: boolean;
  sync?: SyncResult;
  prefilled?: number;
  mail?: SendResult | { skipped: string };
  /** the per-course update mail (22/11) - only the courses the owner switched on */
  courseMail?: CourseSendResult | { skipped: string };
  mirror?: { rows: number } | { skipped: string } | { error: string };
  error?: string;
}

export async function loadPrepSettings(): Promise<PrepSettings> {
  const admin = createAdminClient();
  const { data } = await admin.from(S).select("*").eq("id", 1).maybeSingle();
  return data ?? { id: 1, enabled: false, running_since: null, last_run_at: null, last_run: null, updated_at: new Date().toISOString() };
}

export async function setPrepEnabled(enabled: boolean): Promise<void> {
  const admin = createAdminClient();
  await admin.from(S).upsert({ id: 1, enabled, updated_at: new Date().toISOString() }, { onConflict: "id" });
}

/**
 * One run: the sheet in, the prefill, the mails out (only with the switch on
 * and `send`), the mirror. A lock keeps two runs apart; a stale lock (a run
 * that died) is taken over after ten minutes.
 */
export async function runPrepTick(opts: { send: boolean; trigger: string }): Promise<TickResult> {
  const admin = createAdminClient();
  const at = new Date().toISOString();
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: lock } = await admin.from(S).update({ running_since: at }).eq("id", 1).or(`running_since.is.null,running_since.lt.${stale}`).select("id, enabled").maybeSingle();
  if (!lock) return { ok: false, at, trigger: opts.trigger, skipped: "running" };
  const result: TickResult = { ok: true, at, trigger: opts.trigger, enabled: lock.enabled };
  try {
    result.sync = await syncFromSheet();
    try {
      result.prefilled = await refreshPrefill();
    } catch (e) {
      result.prefilled = -1;
      result.error = `prefill: ${e instanceof Error ? e.message : String(e)}`;
    }
    const deadline = Date.now() + SEND_BUDGET_MS;
    result.mail = !opts.send ? { skipped: "dry" } : lock.enabled ? await sendPending(deadline) : { skipped: "disabled" };
    result.courseMail = !opts.send ? { skipped: "dry" } : await sendCourseUpdatesPending(deadline);
    try {
      result.mirror = await mirrorToSheet();
    } catch (e) {
      result.mirror = { error: e instanceof Error ? e.message : String(e) };
    }
  } catch (e) {
    result.ok = false;
    result.error = e instanceof Error ? e.message : String(e);
  } finally {
    await admin.from(S).update({ running_since: null, last_run_at: new Date().toISOString(), last_run: result as unknown as Json, updated_at: new Date().toISOString() }).eq("id", 1);
  }
  return result;
}

/* ---- the public form ---- */

export async function loadPrepByToken(token: string): Promise<PrepRow | null> {
  if (!/^[a-f0-9]{24}$/i.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from(T).select("*").eq("token", token).maybeSingle();
  return data ?? null;
}

export async function savePrepAnswers(token: string, answers: PrepAnswers): Promise<{ ok: boolean; error?: string }> {
  const row = await loadPrepByToken(token);
  if (!row) return { ok: false, error: "not_found" };
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from(T).update({ answers: answers as unknown as Json, answered_at: now, updated_at: now }).eq("id", row.id);
  if (error) return { ok: false, error: error.message };
  if (!row.is_sample) {
    try {
      await mirrorToSheet();
    } catch (e) {
      console.error("[hc-preconf] mirror after answer failed:", e instanceof Error ? e.message : e);
    }
  }
  return { ok: true };
}

/* ---- the admin ---- */

export async function loadPrepAdmin(): Promise<{ rows: PrepRow[]; settings: PrepSettings; courseUpdates: CourseUpdateRow[] }> {
  const admin = createAdminClient();
  const [{ data: rows }, settings, courseUpdates] = await Promise.all([admin.from(T).select("*").order("is_sample", { ascending: true }).order("sheet_row", { ascending: true, nullsFirst: false }).order("source_key", { ascending: true }), loadPrepSettings(), loadCourseUpdates()]);
  return { rows: rows ?? [], settings, courseUpdates };
}

export async function loadPrepById(id: string): Promise<PrepRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from(T).select("*").eq("id", id).maybeSingle();
  return data ?? null;
}
