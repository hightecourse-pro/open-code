import { serviceAccountToken } from "@/lib/drive-api";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/*
  תיבת המיילים ממנה (the owner, 6.11): ״תכין לכל אחת בפרופיל … תיבת מיילים, כל
  המיילים שהגיעו ממנה לתיבת המייל״ + ״תוסיף טיימר שכל כמה שעות מעדכן מיילים
  חדשים במערכת״. The office mailbox is read through the Gmail API as the Drive
  service account, which the owner allowed to read the mailbox (domain-wide
  delegation, gmail.readonly, 6.11). Every message that reached the mailbox is
  copied into office_mail by the cron (every four hours) or by the admin's
  ״לרענן״, and linked to the member who wrote it (office_mail_link).
*/
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const MAILBOX = () => process.env.OFFICE_MAILBOX || "office@opencode.org.il";
const SYNC_KEY = "office_mail_sync";
/** Everything from the hackathon's season on; older mail is not copied. */
const FLOOR = "2026-09-01T00:00:00Z";
/** New messages copied per run - keeps a run well inside the function's time limit; the rest waits for the next run. */
const PER_RUN = 400;

export interface OfficeMailRow {
  id: string;
  threadId: string | null;
  /** ISO. */
  date: string;
  from: string;
  subject: string;
  snippet: string;
  body: string;
  matchedBy: "email" | "name" | null;
  /** Opens the message in the mailbox (for whoever is signed in to it). */
  url: string;
}

export interface OfficeMailSync {
  lastAt: string | null;
  lastNew: number;
  lastError: string | null;
  /** Unix seconds: older mail still to copy (the first runs work backwards from today to the floor); null = all caught up. */
  backfillBefore: number | null;
}

export function isOfficeMailConfigured(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

async function gmail<T>(path: string): Promise<T> {
  const token = await serviceAccountToken(SCOPE, MAILBOX());
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`gmail_${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
type FullMessage = { id: string; threadId?: string; internalDate: string; snippet?: string; payload?: Part & { headers?: { name: string; value: string }[] } };
const header = (m: FullMessage, name: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
const decode = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
function textOf(p?: Part): string {
  if (!p) return "";
  if (p.mimeType === "text/plain" && p.body?.data) return decode(p.body.data);
  if (p.mimeType === "text/html" && p.body?.data) {
    return decode(p.body.data).replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"");
  }
  for (const part of p.parts ?? []) {
    const t = textOf(part);
    if (t) return t;
  }
  return "";
}
/** The message's own text: the quoted thread below a ״wrote:״ / ״כתב/ה:״ line is cut. */
function freshText(p?: Part): string {
  const text = textOf(p).replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const cut = text.search(/\n(?:On .{5,160}? wrote:|ב[-‏]?[^\n]{0,120}כתב\/ה:|בתאריך [^\n]{0,120}כתב)/);
  return (cut > 40 ? text.slice(0, cut) : text).trim().slice(0, 20_000);
}
function senderOf(from: string): { email: string | null; name: string | null } {
  const email = (from.match(/[\w.+-]+@[\w.-]+\.\w+/) ?? [null])[0];
  const name = from.replace(/<[^>]*>/g, "").replace(/"/g, "").trim();
  return { email: email ? email.toLowerCase() : null, name: name && name !== email ? name : null };
}

export async function getOfficeMailSync(): Promise<OfficeMailSync> {
  const { data } = await createAdminClient().from("app_settings").select("value").eq("key", SYNC_KEY).maybeSingle();
  const v = (data?.value ?? {}) as { last_at?: unknown; last_new?: unknown; last_error?: unknown; backfill_before?: unknown };
  return {
    lastAt: typeof v.last_at === "string" ? v.last_at : null,
    lastNew: typeof v.last_new === "number" ? v.last_new : 0,
    lastError: typeof v.last_error === "string" ? v.last_error : null,
    backfillBefore: typeof v.backfill_before === "number" ? v.backfill_before : null,
  };
}

async function saveSync(v: { last_at: string | null; last_new: number; last_error: string | null; backfill_before: number | null }): Promise<void> {
  await createAdminClient().from("app_settings").upsert({ key: SYNC_KEY, value: v as unknown as Json }, { onConflict: "key" });
}

/** Gmail's ids for a query, newest first, up to `cap`. */
async function listIds(query: string, cap: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const r = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(`messages?q=${encodeURIComponent(query)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`);
    ids.push(...(r.messages ?? []).map((m) => m.id));
    pageToken = r.nextPageToken;
  } while (pageToken && ids.length < cap);
  return ids.slice(0, cap);
}

/** Copies the messages that are not in the table yet; returns how many, and the oldest date among the ones looked at. */
async function copyNew(ids: string[]): Promise<{ added: number; oldest: number | null }> {
  const admin = createAdminClient();
  const known = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("office_mail").select("gmail_id").in("gmail_id", ids.slice(i, i + 200));
    for (const r of data ?? []) known.add(r.gmail_id);
  }
  const fresh = ids.filter((id) => !known.has(id));
  let added = 0;
  let oldest: number | null = null;
  for (let i = 0; i < fresh.length; i += 10) {
    const batch = await Promise.all(fresh.slice(i, i + 10).map((id) => gmail<FullMessage>(`messages/${id}?format=full`)));
    const rows = batch.map((m) => {
      const { email, name } = senderOf(header(m, "from"));
      const sec = Math.floor(Number(m.internalDate) / 1000);
      oldest = oldest === null ? sec : Math.min(oldest, sec);
      return { gmail_id: m.id, thread_id: m.threadId ?? null, from_email: email, from_name: name, subject: header(m, "subject").slice(0, 500), snippet: (m.snippet ?? "").slice(0, 1000), body: freshText(m.payload), sent_at: new Date(Number(m.internalDate)).toISOString() };
    });
    const { error } = await admin.from("office_mail").upsert(rows, { onConflict: "gmail_id", ignoreDuplicates: true });
    if (error) throw error;
    added += rows.length;
  }
  return { added, oldest };
}

/**
 * One run: new mail since the last run (two days of overlap) - and, while the season's
 * older mail is not all copied yet, one more slice of it going backwards (`backfill_before`).
 * `full` starts the backward walk again from today. Our own outgoing mail is left out.
 */
export async function syncOfficeMail(opts?: { full?: boolean }): Promise<{ scanned: number; added: number; linked: number; backfillLeft: boolean }> {
  const admin = createAdminClient();
  const prev = await getOfficeMailSync();
  const base = `-from:${MAILBOX()} -in:sent -in:drafts`;
  const floorSec = Math.floor(Date.parse(FLOOR) / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  const first = !prev.lastAt;
  try {
    let scanned = 0, added = 0;
    // 1. the fresh slice - since the last run; the very first run (or `full`) starts the backward walk instead
    let backfillBefore = opts?.full || first ? nowSec + 60 : prev.backfillBefore;
    if (!first && !opts?.full) {
      const ids = await listIds(`after:${Math.floor((Date.parse(prev.lastAt as string) - 2 * 86_400_000) / 1000)} ${base}`, PER_RUN);
      scanned += ids.length;
      added += (await copyNew(ids)).added;
    }
    // 2. one slice of the backlog, newest first, down to the floor
    if (backfillBefore) {
      const ids = await listIds(`after:${floorSec} before:${backfillBefore} ${base}`, PER_RUN);
      scanned += ids.length;
      const r = await copyNew(ids);
      added += r.added;
      backfillBefore = ids.length < PER_RUN ? null : (r.oldest ?? backfillBefore - 86_400);
    }
    const { data: linked } = await admin.rpc("office_mail_link");
    await saveSync({ last_at: new Date().toISOString(), last_new: added, last_error: null, backfill_before: backfillBefore });
    return { scanned, added, linked: typeof linked === "number" ? linked : 0, backfillLeft: backfillBefore !== null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await saveSync({ last_at: prev.lastAt, last_new: prev.lastNew, last_error: msg.slice(0, 300), backfill_before: prev.backfillBefore });
    throw e;
  }
}

/** Her mail, newest first (the admin's member page). */
export async function loadOfficeMailFor(profileId: string): Promise<OfficeMailRow[]> {
  const { data } = await createAdminClient().from("office_mail").select("gmail_id, thread_id, from_email, from_name, matched_by, subject, snippet, body, sent_at").eq("profile_id", profileId).order("sent_at", { ascending: false }).limit(200);
  return (data ?? []).map((r) => ({
    id: r.gmail_id,
    threadId: r.thread_id,
    date: r.sent_at,
    from: r.from_name ? `${r.from_name} <${r.from_email ?? ""}>` : (r.from_email ?? ""),
    subject: r.subject ?? "",
    snippet: r.snippet ?? "",
    body: r.body ?? "",
    matchedBy: (r.matched_by as "email" | "name" | null) ?? null,
    url: `https://mail.google.com/mail/#all/${r.gmail_id}`,
  }));
}
