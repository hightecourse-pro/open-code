import { serviceAccountToken } from "@/lib/drive-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProductionEnv } from "@/lib/env";
import type { Json } from "@/types/database";

/*
  תיבת המיילים ממנה (the owner, 6.11): ״תכין לכל אחת בפרופיל … תיבת מיילים, כל
  המיילים שהגיעו ממנה לתיבת המייל״ + ״טיימר שכל כמה שעות מעדכן מיילים חדשים״ +
  ״תסמן מה לא נקרא ותאפשר לי לענות דרך המערכת; אם היתה תשובה למייל שאראה אותה״.
  The office mailbox is read - and answered - through the Gmail API as the Drive
  service account, under the domain-wide delegation the owner granted on 6.11
  (gmail.readonly for the copy; gmail.modify for marking read and for sending).
  Every message in the mailbox, in and out, is copied into office_mail by the cron
  (every four hours) or by the admin's ״לרענן״; incoming mail is linked to the member
  who wrote it (office_mail_link); a reply is sent in the same thread and copied too.
*/
const SCOPE_READ = "https://www.googleapis.com/auth/gmail.readonly";
const SCOPE_MODIFY = "https://www.googleapis.com/auth/gmail.modify";
const MAILBOX = () => process.env.OFFICE_MAILBOX || "office@opencode.org.il";
const MAILBOX_NAME = "קוד פתוח";
const SYNC_KEY = "office_mail_sync";
/** Everything from the hackathon's season on; older mail is not copied. */
const FLOOR = "2026-09-01T00:00:00Z";
/** New messages copied per run - keeps a run well inside the function's time limit; the rest waits for the next run. */
const PER_RUN = 400;

export interface OfficeMailReply {
  id: string;
  date: string;
  from: string;
  body: string;
  /** Sent from the app (by an admin) rather than from Gmail. */
  viaApp: boolean;
}

export interface OfficeMailRow {
  id: string;
  threadId: string | null;
  /** ISO. */
  date: string;
  from: string;
  fromEmail: string | null;
  subject: string;
  snippet: string;
  body: string;
  matchedBy: "email" | "name" | null;
  /** Unread in the mailbox and not yet opened here. */
  unread: boolean;
  /** Our answers in the same thread, oldest first. */
  replies: OfficeMailReply[];
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

class GmailError extends Error {
  constructor(public status: number, text: string) {
    super(`gmail_${status}: ${text.slice(0, 200)}`);
  }
}
/** A 403 from Gmail on a write = the delegation lacks gmail.modify. */
export const isScopeError = (e: unknown) => e instanceof GmailError && e.status === 403;

async function gmail<T>(path: string, init?: RequestInit, scope: string = SCOPE_READ): Promise<T> {
  const token = await serviceAccountToken(scope, MAILBOX());
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new GmailError(res.status, await res.text());
  return (await res.json()) as T;
}

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
type FullMessage = { id: string; threadId?: string; internalDate: string; snippet?: string; labelIds?: string[]; payload?: Part & { headers?: { name: string; value: string }[] } };
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
  // Gmail's quote header, in English or in Hebrew (״בתאריך … מאת …״ / ״… כתב/ה:״), possibly behind RTL marks.
  const cut = text.search(/\n[‎‏‪-‮]*(?:On .{5,160}? wrote:|ב[-‏]?[^\n]{0,120}כתב\/ה:|בתאריך [^\n]{0,200}(?:כתב|מאת))/);
  const own = (cut > 40 ? text.slice(0, cut) : text).split("\n").filter((l) => !/^\s*[‎‏‪-‮]*>/.test(l)).join("\n");
  return own.trim().slice(0, 20_000);
}
function senderOf(from: string): { email: string | null; name: string | null } {
  const email = (from.match(/[\w.+-]+@[\w.-]+\.\w+/) ?? [null])[0];
  const name = from.replace(/<[^>]*>/g, "").replace(/"/g, "").trim();
  return { email: email ? email.toLowerCase() : null, name: name && name !== email ? name : null };
}
function rowOf(m: FullMessage, extra?: { sent_by?: string | null }) {
  const { email, name } = senderOf(header(m, "from"));
  const labels = m.labelIds ?? [];
  const out = labels.includes("SENT") || (email !== null && email === MAILBOX().toLowerCase());
  return {
    gmail_id: m.id,
    thread_id: m.threadId ?? null,
    from_email: email,
    from_name: name,
    direction: out ? "out" : "in",
    unread: !out && labels.includes("UNREAD"),
    rfc_message_id: header(m, "message-id") || null,
    subject: header(m, "subject").slice(0, 500),
    snippet: (m.snippet ?? "").slice(0, 1000),
    body: freshText(m.payload),
    sent_at: new Date(Number(m.internalDate)).toISOString(),
    ...(extra ?? {}),
  };
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

/** Copies the messages that are not in the table yet; refreshes the unread flag of the known ones. */
async function copyNew(ids: string[], refreshKnown: boolean): Promise<{ added: number; oldest: number | null }> {
  const admin = createAdminClient();
  const known = new Map<string, boolean>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("office_mail").select("gmail_id, unread").in("gmail_id", ids.slice(i, i + 200));
    for (const r of data ?? []) known.set(r.gmail_id, r.unread);
  }
  const fresh = ids.filter((id) => !known.has(id));
  let added = 0;
  let oldest: number | null = null;
  for (let i = 0; i < fresh.length; i += 10) {
    const batch = await Promise.all(fresh.slice(i, i + 10).map((id) => gmail<FullMessage>(`messages/${id}?format=full`)));
    const rows = batch.map((m) => {
      const sec = Math.floor(Number(m.internalDate) / 1000);
      oldest = oldest === null ? sec : Math.min(oldest, sec);
      return rowOf(m);
    });
    const { error } = await admin.from("office_mail").upsert(rows, { onConflict: "gmail_id", ignoreDuplicates: true });
    if (error) throw error;
    added += rows.length;
  }
  if (refreshKnown) {
    // The unread flag follows the mailbox, both ways: read there = not marked here; marked unread again there = marked here.
    const knownIds = [...known.keys()];
    for (let i = 0; i < knownIds.length; i += 10) {
      const batch = await Promise.all(knownIds.slice(i, i + 10).map((id) => gmail<{ id: string; labelIds?: string[] }>(`messages/${id}?format=minimal`)));
      const nowRead = batch.filter((m) => !(m.labelIds ?? []).includes("UNREAD") && known.get(m.id) === true).map((m) => m.id);
      const nowUnread = batch.filter((m) => (m.labelIds ?? []).includes("UNREAD") && !(m.labelIds ?? []).includes("SENT") && known.get(m.id) === false).map((m) => m.id);
      if (nowRead.length) await admin.from("office_mail").update({ unread: false }).in("gmail_id", nowRead);
      if (nowUnread.length) await admin.from("office_mail").update({ unread: true }).eq("direction", "in").in("gmail_id", nowUnread);
    }
  }
  return { added, oldest };
}

/**
 * One run: new mail since the last run (two days of overlap) - and, while the season's
 * older mail is not all copied yet, one more slice of it going backwards (`backfill_before`).
 * `full` starts the backward walk again from today. In and out, drafts left out.
 */
export async function syncOfficeMail(opts?: { full?: boolean }): Promise<{ scanned: number; added: number; linked: number; backfillLeft: boolean }> {
  const admin = createAdminClient();
  const prev = await getOfficeMailSync();
  const base = "-in:drafts -in:spam -in:trash";
  const floorSec = Math.floor(Date.parse(FLOOR) / 1000);
  const nowSec = Math.floor(Date.now() / 1000);
  const first = !prev.lastAt;
  try {
    let scanned = 0, added = 0;
    let backfillBefore = opts?.full || first ? nowSec + 60 : prev.backfillBefore;
    if (!first && !opts?.full) {
      const ids = await listIds(`after:${Math.floor((Date.parse(prev.lastAt as string) - 2 * 86_400_000) / 1000)} ${base}`, PER_RUN);
      scanned += ids.length;
      added += (await copyNew(ids, true)).added;
    }
    if (backfillBefore) {
      const ids = await listIds(`after:${floorSec} before:${backfillBefore} ${base}`, PER_RUN);
      scanned += ids.length;
      const r = await copyNew(ids, false);
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

/** Her incoming mail, newest first, each with our answers in its thread (the admin's member page). */
export async function loadOfficeMailFor(profileId: string): Promise<OfficeMailRow[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("office_mail").select("gmail_id, thread_id, from_email, from_name, matched_by, subject, snippet, body, sent_at, unread, read_in_app_at").eq("profile_id", profileId).eq("direction", "in").order("sent_at", { ascending: false }).limit(200);
  const rows = data ?? [];
  const threads = [...new Set(rows.map((r) => r.thread_id).filter((t): t is string => !!t))];
  const repliesOf = new Map<string, OfficeMailReply[]>();
  if (threads.length) {
    const { data: outs } = await admin.from("office_mail").select("gmail_id, thread_id, from_email, from_name, body, snippet, sent_at, sent_by").in("thread_id", threads).eq("direction", "out").order("sent_at", { ascending: true });
    for (const o of outs ?? []) {
      if (!o.thread_id) continue;
      repliesOf.set(o.thread_id, [...(repliesOf.get(o.thread_id) ?? []), { id: o.gmail_id, date: o.sent_at, from: o.from_name ?? o.from_email ?? MAILBOX_NAME, body: o.body || o.snippet || "", viaApp: !!o.sent_by }]);
    }
  }
  return rows.map((r) => ({
    id: r.gmail_id,
    threadId: r.thread_id,
    date: r.sent_at,
    from: r.from_name ? `${r.from_name} <${r.from_email ?? ""}>` : (r.from_email ?? ""),
    fromEmail: r.from_email,
    subject: r.subject ?? "",
    snippet: r.snippet ?? "",
    body: r.body ?? "",
    matchedBy: (r.matched_by as "email" | "name" | null) ?? null,
    unread: !!r.unread && !r.read_in_app_at,
    replies: (r.thread_id ? repliesOf.get(r.thread_id) ?? [] : []).filter((x) => x.date >= r.sent_at),
    url: `https://mail.google.com/mail/#all/${r.gmail_id}`,
  }));
}

/** Opened in the app: stamped here, and marked read in the mailbox when the delegation allows it. */
export async function markOfficeMailRead(gmailId: string): Promise<{ inMailbox: boolean }> {
  const admin = createAdminClient();
  await admin.from("office_mail").update({ read_in_app_at: new Date().toISOString() }).eq("gmail_id", gmailId);
  try {
    await gmail(`messages/${gmailId}/modify`, { method: "POST", body: JSON.stringify({ removeLabelIds: ["UNREAD"] }) }, SCOPE_MODIFY);
    await admin.from("office_mail").update({ unread: false }).eq("gmail_id", gmailId);
    return { inMailbox: true };
  } catch (e) {
    if (isScopeError(e) || (e instanceof Error && /drive_auth_failed/.test(e.message))) return { inMailbox: false };
    throw e;
  }
}

const mimeWord = (s: string) => (/[^\x20-\x7e]/.test(s) ? `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=` : s);

/** Thrown by sendOfficeMailReply when the thread already holds an answer of ours and `force` was not given. */
export class AlreadyAnswered extends Error {
  constructor(public replies: OfficeMailReply[]) {
    super("already_answered");
  }
}

/**
 * Our answers in the message's thread, live from the mailbox (״תבדוק אם לא ענו כבר״ - the owner, 6.11):
 * anything sent from office@ after the message, whether from the app or from Gmail. The ones the
 * sync has not copied yet are copied now, so the page shows them too.
 */
async function repliesInThread(threadId: string, origId: string, origSentAt: string): Promise<OfficeMailReply[]> {
  const admin = createAdminClient();
  const th = await gmail<{ messages?: FullMessage[] }>(`threads/${threadId}?format=full`);
  const after = Date.parse(origSentAt);
  const ours = (th.messages ?? []).filter((m) => {
    if (m.id === origId || Number(m.internalDate) <= after) return false;
    const { email } = senderOf(header(m, "from"));
    return (m.labelIds ?? []).includes("SENT") || email === MAILBOX().toLowerCase();
  });
  if (ours.length === 0) return [];
  const rows = ours.map((m) => ({ ...rowOf(m), direction: "out", unread: false }));
  await admin.from("office_mail").upsert(rows, { onConflict: "gmail_id", ignoreDuplicates: true });
  const { data: stored } = await admin.from("office_mail").select("gmail_id, sent_by").in("gmail_id", ours.map((m) => m.id));
  const viaApp = new Set((stored ?? []).filter((r) => r.sent_by).map((r) => r.gmail_id));
  return rows.map((r) => ({ id: r.gmail_id, date: r.sent_at, from: r.from_name ?? r.from_email ?? MAILBOX_NAME, body: r.body || r.snippet, viaApp: viaApp.has(r.gmail_id) }));
}

/**
 * A reply from the app, in the message's own thread, from office@ with the admin's name
 * signed under the text. Outside production only addresses in EMAIL_ALLOWLIST may be written to.
 * The sent message is copied into office_mail at once, so it shows under the question.
 */
export async function sendOfficeMailReply(args: { gmailId: string; text: string; byId: string; byName: string; force?: boolean }): Promise<{ id: string }> {
  const admin = createAdminClient();
  const { data: orig } = await admin.from("office_mail").select("gmail_id, thread_id, from_email, from_name, subject, rfc_message_id, direction, sent_at").eq("gmail_id", args.gmailId).maybeSingle();
  if (!orig || orig.direction !== "in" || !orig.from_email) throw new Error("not_found");
  // ״אם אני באה לענות על מייל מהמערכת תבדוק אם לא ענו כבר״ (the owner, 6.11): the thread, live, unless she insists.
  if (!args.force && orig.thread_id) {
    const answered = await repliesInThread(orig.thread_id, orig.gmail_id, orig.sent_at);
    if (answered.length) throw new AlreadyAnswered(answered);
  }
  if (!isProductionEnv()) {
    const allow = (process.env.EMAIL_ALLOWLIST ?? "").split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!allow.includes(orig.from_email.toLowerCase())) throw new Error("staging_allowlist");
  }
  const subject = /^re:/i.test(orig.subject ?? "") ? (orig.subject as string) : `Re: ${orig.subject ?? ""}`;
  const text = `${args.text.trim()}\n\n${args.byName}\nקהילת קוד פתוח`;
  const lines = [
    `From: ${mimeWord(MAILBOX_NAME)} <${MAILBOX()}>`,
    `To: ${orig.from_name ? `${mimeWord(orig.from_name)} <${orig.from_email}>` : orig.from_email}`,
    `Subject: ${mimeWord(subject)}`,
    ...(orig.rfc_message_id ? [`In-Reply-To: ${orig.rfc_message_id}`, `References: ${orig.rfc_message_id}`] : []),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text, "utf8").toString("base64"),
  ];
  const raw = Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
  const sent = await gmail<{ id: string; threadId: string }>("messages/send", { method: "POST", body: JSON.stringify({ raw, ...(orig.thread_id ? { threadId: orig.thread_id } : {}) }) }, SCOPE_MODIFY);
  const full = await gmail<FullMessage>(`messages/${sent.id}?format=full`);
  const row = { ...rowOf(full, { sent_by: args.byId }), direction: "out", unread: false, body: text };
  await admin.from("office_mail").upsert(row, { onConflict: "gmail_id" });
  await admin.from("office_mail").update({ read_in_app_at: new Date().toISOString(), unread: false }).eq("gmail_id", args.gmailId);
  return { id: sent.id };
}
