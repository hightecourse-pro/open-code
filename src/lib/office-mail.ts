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
  const v = (data?.value ?? {}) as { last_at?: unknown; last_new?: unknown; last_error?: unknown };
  return { lastAt: typeof v.last_at === "string" ? v.last_at : null, lastNew: typeof v.last_new === "number" ? v.last_new : 0, lastError: typeof v.last_error === "string" ? v.last_error : null };
}

/**
 * New mail since the last run (two days of overlap; `full` = everything since 1.9.2026)
 * into office_mail, then the linking. Our own outgoing mail is left out.
 */
export async function syncOfficeMail(opts?: { full?: boolean }): Promise<{ scanned: number; added: number; linked: number }> {
  const admin = createAdminClient();
  const prev = await getOfficeMailSync();
  const sinceSec = opts?.full || !prev.lastAt ? Math.floor(Date.parse("2026-09-01T00:00:00Z") / 1000) : Math.floor((Date.parse(prev.lastAt) - 2 * 86_400_000) / 1000);
  const query = `after:${sinceSec} -from:${MAILBOX()} -in:sent -in:drafts`;
  try {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const r = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(`messages?q=${encodeURIComponent(query)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ""}`);
      ids.push(...(r.messages ?? []).map((m) => m.id));
      pageToken = r.nextPageToken;
    } while (pageToken && ids.length < 1000);

    const known = new Set<string>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await admin.from("office_mail").select("gmail_id").in("gmail_id", ids.slice(i, i + 200));
      for (const r of data ?? []) known.add(r.gmail_id);
    }
    const fresh = ids.filter((id) => !known.has(id));
    let added = 0;
    for (let i = 0; i < fresh.length; i += 10) {
      const batch = await Promise.all(fresh.slice(i, i + 10).map((id) => gmail<FullMessage>(`messages/${id}?format=full`)));
      const rows = batch.map((m) => {
        const { email, name } = senderOf(header(m, "from"));
        return { gmail_id: m.id, thread_id: m.threadId ?? null, from_email: email, from_name: name, subject: header(m, "subject").slice(0, 500), snippet: (m.snippet ?? "").slice(0, 1000), body: freshText(m.payload), sent_at: new Date(Number(m.internalDate)).toISOString() };
      });
      const { error } = await admin.from("office_mail").upsert(rows, { onConflict: "gmail_id", ignoreDuplicates: true });
      if (error) throw error;
      added += rows.length;
    }
    const { data: linked } = await admin.rpc("office_mail_link");
    await admin.from("app_settings").upsert({ key: SYNC_KEY, value: { last_at: new Date().toISOString(), last_new: added, last_error: null } as unknown as Json }, { onConflict: "key" });
    return { scanned: ids.length, added, linked: typeof linked === "number" ? linked : 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("app_settings").upsert({ key: SYNC_KEY, value: { last_at: prev.lastAt, last_new: prev.lastNew, last_error: msg.slice(0, 300) } as unknown as Json }, { onConflict: "key" });
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
