// גמר ההאקתון בשידור חי (the owner, 26/10): the control panel decides the
// question order and the weights, the hall screen shows the audience's phone
// votes and the judges' scores live, and the judges score from their phones.
//
// Every criterion has an owner. The judges score theirs 1-10; the audience
// picks the best project per audience criterion in a phone vote of its own
// (one question per criterion, run one after another). The final score is one
// weighted sum - judges 70, audience 30 by default.
//
// The audience votes through Yemot Hamashiach: the extension is of type
// recording_and_entering_data looping on itself, every keypress is a line in
// its ApprovalAll.ymgr, and we poll that file - one fetch per 1.5s, claimed
// through settings.poll_claimed_at so every open screen shares the same poll.
// The last valid keypress of a phone is its vote; the line key keeps every
// keypress counted once. All logic is here; the pages only render.
import { createAdminClient } from "@/lib/supabase/admin";
import {
  audienceCriteria,
  judgeTotal,
  judgesCriteria,
  round1,
  weightSum,
  LIVE_MAX_FINALISTS,
  LIVE_MAX_OPTIONS,
  LIVE_MIN_FINALISTS,
  LIVE_MIN_OPTIONS,
  LIVE_SCALE,
  type LiveAdminChallenge,
  type LiveAdminView,
  type LiveAudienceMode,
  type LiveCategoryView,
  type LiveChallengeStatus,
  type LiveCriterion,
  type LiveDisplayView,
  type LiveFinalistRow,
  type LiveFinalsView,
  type LiveJudgeView,
  type LiveQuestionStatus,
  type LiveQuestionView,
  type LiveReveal,
} from "@/lib/hackathon-live-shared";
import type { Database, Json } from "@/types/database";

type SettingsRow = Database["public"]["Tables"]["hackathon_live_settings"]["Row"];
type ChallengeRow = Database["public"]["Tables"]["hackathon_live_challenges"]["Row"];
type FinalistRow = Database["public"]["Tables"]["hackathon_live_finalists"]["Row"];
type JudgeRow = Database["public"]["Tables"]["hackathon_live_judges"]["Row"];
type ScoreRow = Database["public"]["Tables"]["hackathon_live_scores"]["Row"];
type QuestionRow = Database["public"]["Tables"]["hackathon_live_questions"]["Row"];

const POLL_EVERY_MS = 1500;
const CALLS_EVERY_MS = 3000;
/** A keypress older than this before the question opened belongs to nobody (a leftover line in the file). */
const STALE_GRACE_MS = 15_000;
const YEMOT_API = "https://www.call2all.co.il/ym/api";
const VOTES_FILE = "ApprovalAll.ymgr";

export class LiveError extends Error {}
const fail = (msg: string): never => {
  throw new LiveError(msg);
};

/* ───────────────────────── helpers ───────────────────────── */

const strArr = (v: Json): string[] => (Array.isArray(v) ? v.map((x) => String(x)) : []);
const asStatus = (s: string): LiveQuestionStatus => (s === "open" || s === "closed" ? s : "idle");
const asChStatus = (s: string): LiveChallengeStatus => (s === "judging" || s === "closed" ? s : "idle");
const asReveal = (s: string): LiveReveal => (s === "end" ? "end" : "live");

export function normalizeCriteria(list: unknown): LiveCriterion[] {
  if (!Array.isArray(list) || !list.length) fail("נדרש לפחות קריטריון אחד");
  const out: LiveCriterion[] = (list as Record<string, unknown>[]).map((c, i) => {
    const label = String(c?.label ?? "").trim();
    if (!label) fail(`לקריטריון ${i + 1} חסר שם`);
    const weight = Number(c?.weight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) fail(`המשקל של "${label}" חייב להיות בין 0 ל-100`);
    const key = /^[a-z0-9_-]{1,24}$/i.test(String(c?.key ?? "")) ? String(c.key) : `c${Math.random().toString(36).slice(2, 8)}`;
    return { key, label, weight: Math.round(weight * 10) / 10, owner: c?.owner === "audience" ? "audience" : "judges", hint: String(c?.hint ?? "").trim() };
  });
  const sum = out.reduce((s, c) => s + c.weight, 0);
  if (Math.abs(sum - 100) > 0.01) fail(`סכום המשקלים חייב להיות 100 (עכשיו ${round1(sum)})`);
  if (new Set(out.map((c) => c.key)).size !== out.length) fail("שני קריטריונים עם אותו מפתח");
  if (!judgesCriteria(out).length) fail("נדרש לפחות קריטריון אחד לשופטות");
  return out;
}

function criteriaOf(s: SettingsRow): LiveCriterion[] {
  try {
    return normalizeCriteria(s.criteria);
  } catch {
    return [];
  }
}

const weightsOf = (criteria: LiveCriterion[]) => ({ judges: weightSum(judgesCriteria(criteria)), audience: weightSum(audienceCriteria(criteria)) });

/** Yemot writes Israel local time ("dd/MM/yyyy", "HH:mm:ss"); we store UTC. */
function israelToUtc(dateStr: string, timeStr: string): number {
  const d = String(dateStr || "").split("/");
  const t = String(timeStr || "").split(":");
  if (d.length !== 3) return 0;
  const guess = Date.UTC(+d[2], +d[1] - 1, +d[0], +(t[0] || 0), +(t[1] || 0), +(t[2] || 0));
  if (!Number.isFinite(guess)) return 0;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(guess));
  const get = (k: string) => Number(parts.find((p) => p.type === k)?.value ?? 0);
  const asIsrael = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return guess - (asIsrael - guess);
}

interface YemotLine {
  key: string;
  phone: string;
  digit: number;
  time: number;
}

/** Every keypress in the file: a line per record, % between columns, # between name and value. */
export function extractVotes(text: string): YemotLine[] {
  const out: YemotLine[] = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row: Record<string, string> = {};
    for (const pair of line.split("%")) {
      const p = pair.indexOf("#");
      if (p > 0) row[pair.slice(0, p)] = pair.slice(p + 1);
    }
    const col = "P050" in row ? "P050" : Object.keys(row).find((k) => /^P\d+$/.test(k));
    const phone = String(row.Phone || row.EnterId || "").trim();
    const value = col ? String(row[col] || "").trim() : "";
    if (!phone || !value) continue;
    out.push({ key: `${phone}|${row.Date || ""}|${row.Time || ""}|${value}`, phone, digit: /^\d$/.test(value) ? Number(value) : -1, time: israelToUtc(row.Date, row.Time) });
  }
  return out;
}

function callsInExtension(calls: unknown[], extension: string): number {
  const ext = String(extension || "").replace(/^\/+|\/+$/g, "");
  if (!ext) return 0;
  return calls.filter((c) => {
    const p = String((c as { path?: string })?.path ?? "").replace(/^\/+/, "");
    const segs = p.split("/").map((x) => x.trim());
    const first = segs[0] ?? "";
    return first === ext || first.startsWith(ext + " ") || segs.includes(ext);
  }).length;
}

/* ───────────────────────── Yemot ───────────────────────── */

const isApiKey = (token: string) => /\.apik_/.test(token);

async function yemotCall(token: string, command: string, params: Record<string, string> = {}, timeoutMs = 12_000): Promise<{ ok: boolean; json: Record<string, unknown> | null; error?: string }> {
  const tok = token.trim();
  if (!tok) return { ok: false, json: null, error: "חסר מפתח גישה לימות" };
  const body = new URLSearchParams();
  if (!isApiKey(tok)) body.set("token", tok);
  for (const [k, v] of Object.entries(params)) body.set(k, v);
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded; charset=utf-8" };
  if (isApiKey(tok)) headers.authorization = tok;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${YEMOT_API}/${command}`, { method: "POST", headers, body: body.toString(), signal: controller.signal, cache: "no-store" });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* not every command answers JSON */
    }
    if (!res.ok) return { ok: false, json, error: `שרת ימות החזיר שגיאה ${res.status}` };
    if (json && json.responseStatus && json.responseStatus !== "OK") {
      const msg = String(json.message ?? "");
      const error = /session token is required/i.test(msg) ? "המפתח נדחה - בדקי שהעתקת את מפתח ה-API במלואו" : msg || "ימות החזירה שגיאה";
      return { ok: false, json, error };
    }
    return { ok: true, json };
  } catch (e) {
    return { ok: false, json: null, error: (e as Error).name === "AbortError" ? "פסק זמן בפנייה לימות" : (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

async function yemotTextFile(token: string, what: string): Promise<{ ok: boolean; exists: boolean; contents: string; error?: string }> {
  const r = await yemotCall(token, "GetTextFile", { what });
  if (r.ok) return { ok: true, exists: true, contents: String(r.json?.contents ?? "") };
  if (r.json && /not exist/i.test(String(r.json.message ?? ""))) return { ok: true, exists: false, contents: "" };
  return { ok: false, exists: false, contents: "", error: r.error };
}

const votesPath = (ext: string) => `ivr2:${ext}/${VOTES_FILE}`;

/** The file only grows and every poll downloads it whole - so it is moved aside when a question opens. */
async function archiveVotesFile(token: string, ext: string): Promise<void> {
  const exists = await yemotTextFile(token, votesPath(ext));
  if (!exists.ok || !exists.exists) return;
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const target = `ivr2:${ext}/ApprovalAll-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.ymgr`;
  await yemotCall(token, "FileAction", { action: "move", what: votesPath(ext), target });
}

/** Only the keys of this question's options are accepted by the phone - "בחירה לא חוקית" for the rest. */
async function setAllowedKeys(token: string, ext: string, nOptions: number): Promise<void> {
  const n = Math.min(9, Math.max(1, nOptions));
  await yemotCall(token, "UpdateExtension", { path: `ivr2:${ext}`, "050-option": `1-1-7-Digits-AskNo-${"123456789".slice(0, n)}` });
}

export async function yemotTest(): Promise<{ ok: boolean; error?: string; extensionExists?: boolean; extensionType?: string | null; isVotingExtension?: boolean; votesInFile?: number | null; activeCalls?: number | null }> {
  const s = await loadSettings();
  if (!s.yemot_token.trim() || !s.yemot_extension.trim()) return { ok: false, error: "הזיני מפתח גישה ומספר שלוחה ושמרי לפני הבדיקה" };
  const ext = s.yemot_extension.trim();
  const ini = await yemotTextFile(s.yemot_token, `ivr2:${ext}/ext.ini`);
  if (!ini.ok) return { ok: false, error: ini.error };
  const typeMatch = /^\s*type\s*=\s*(.+?)\s*$/m.exec(ini.contents || "");
  const votes = await yemotTextFile(s.yemot_token, votesPath(ext));
  const calls = await yemotCall(s.yemot_token, "GetIncomingCalls");
  const callList = Array.isArray(calls.json?.calls) ? (calls.json!.calls as unknown[]) : [];
  return {
    ok: true,
    extensionExists: ini.exists,
    extensionType: typeMatch ? typeMatch[1] : null,
    isVotingExtension: !!typeMatch && typeMatch[1] === "recording_and_entering_data",
    votesInFile: votes.ok ? extractVotes(votes.contents).length : null,
    activeCalls: calls.ok ? callsInExtension(callList, ext) : null,
  };
}

/* ───────────────────────── settings ───────────────────────── */

async function loadSettings(): Promise<SettingsRow> {
  const admin = createAdminClient();
  const { data } = await admin.from("hackathon_live_settings").select("*").eq("id", 1).maybeSingle();
  if (!data) fail("הגדרות השידור החי חסרות - המיגרציה לא רצה");
  return data!;
}

export async function updateLiveSettings(patch: Record<string, unknown>): Promise<void> {
  const next: Database["public"]["Tables"]["hackathon_live_settings"]["Update"] = { updated_at: new Date().toISOString() };
  if (patch.eventName !== undefined) next.event_name = String(patch.eventName ?? "").trim().slice(0, 80) || "האקתון AI קוד פתוח 2026";
  if (patch.phoneDisplay !== undefined) next.phone_display = String(patch.phoneDisplay ?? "").trim().slice(0, 40);
  if (typeof patch.yemotToken === "string" && patch.yemotToken.trim()) next.yemot_token = patch.yemotToken.trim();
  if (patch.clearToken) next.yemot_token = "";
  if (patch.yemotExtension !== undefined) next.yemot_extension = String(patch.yemotExtension ?? "").trim().replace(/^\/+|\/+$/g, "").slice(0, 20);
  if (patch.judgeCode !== undefined) {
    const code = String(patch.judgeCode ?? "").trim();
    if (!/^[0-9A-Za-zא-ת]{3,12}$/.test(code)) fail("קוד השופטות: 3 עד 12 אותיות או ספרות, בלי רווחים");
    next.judge_code = code;
  }
  if (patch.audienceMode !== undefined) {
    const mode = String(patch.audienceMode);
    if (mode !== "leader" && mode !== "share") fail("שיטת ציון הקהל לא מוכרת");
    next.audience_mode = mode;
  }
  if (patch.reveal !== undefined) {
    const reveal = String(patch.reveal);
    if (reveal !== "live" && reveal !== "end") fail("מצב החשיפה לא מוכר");
    next.reveal = reveal;
  }
  if (patch.theme !== undefined) next.theme = patch.theme === "dark" ? "dark" : "light";
  if (patch.criteria !== undefined) next.criteria = normalizeCriteria(patch.criteria) as unknown as Json;
  const { error } = await createAdminClient().from("hackathon_live_settings").update(next).eq("id", 1);
  if (error) fail(error.message);
}

/* ───────────────────────── polling the audience ───────────────────────── */

async function openQuestionRow(): Promise<QuestionRow | null> {
  const { data } = await createAdminClient().from("hackathon_live_questions").select("*").eq("status", "open").limit(1).maybeSingle();
  return data ?? null;
}

/**
 * One poll per 1.5s across every screen: the caller that wins the claim fetches
 * the file; everybody else just reads what is already stored.
 */
export async function pollAudience(): Promise<void> {
  const admin = createAdminClient();
  const now = Date.now();
  const { data: claimed } = await admin
    .from("hackathon_live_settings")
    .update({ poll_claimed_at: new Date(now).toISOString() })
    .eq("id", 1)
    .or(`poll_claimed_at.is.null,poll_claimed_at.lt.${new Date(now - POLL_EVERY_MS).toISOString()}`)
    .select("yemot_token, yemot_extension, calls_claimed_at")
    .maybeSingle();
  if (!claimed) return;
  const token = claimed.yemot_token.trim();
  const ext = claimed.yemot_extension.trim();
  if (!token || !ext) {
    await admin.from("hackathon_live_settings").update({ poll_error: "לא הוגדר חיבור לימות" }).eq("id", 1);
    return;
  }
  const r = await yemotTextFile(token, votesPath(ext));
  if (!r.ok) {
    await admin.from("hackathon_live_settings").update({ poll_error: r.error ?? "משיכת ההצבעות נכשלה" }).eq("id", 1);
    return;
  }
  const lines = extractVotes(r.contents);
  if (lines.length) {
    const open = await openQuestionRow();
    const openedAt = open?.opened_at ? Date.parse(open.opened_at) : 0;
    const rows = lines.map((l) => ({
      key: l.key,
      phone: l.phone,
      digit: l.digit,
      voted_at: new Date(l.time || now).toISOString(),
      // a keypress from before the question opened is a leftover line, not a vote for it
      question_id: open && (!l.time || l.time >= openedAt - STALE_GRACE_MS) ? open.id : null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from("hackathon_live_votes").upsert(rows.slice(i, i + 500), { onConflict: "key", ignoreDuplicates: true });
      if (error) {
        await admin.from("hackathon_live_settings").update({ poll_error: error.message }).eq("id", 1);
        return;
      }
    }
  }
  const patch: Database["public"]["Tables"]["hackathon_live_settings"]["Update"] = { last_poll_at: new Date().toISOString(), poll_error: null };
  if (!claimed.calls_claimed_at || Date.parse(claimed.calls_claimed_at) < now - CALLS_EVERY_MS) {
    const c = await yemotCall(token, "GetIncomingCalls");
    if (c.ok) patch.connected = callsInExtension(Array.isArray(c.json?.calls) ? (c.json!.calls as unknown[]) : [], ext);
    patch.calls_claimed_at = new Date().toISOString();
  }
  await admin.from("hackathon_live_settings").update(patch).eq("id", 1);
}

/* ───────────────────────── tallies ───────────────────────── */

interface Tally {
  counts: number[];
  voted: number;
  changed: number;
  invalid: number;
}

async function tallyOf(q: QuestionRow): Promise<Tally> {
  const options = strArr(q.options);
  const counts = options.map(() => 0);
  const { data: votes } = await createAdminClient()
    .from("hackathon_live_votes")
    .select("phone, digit, voted_at, key")
    .eq("question_id", q.id)
    .order("voted_at", { ascending: true })
    .order("key", { ascending: true })
    .limit(20000);
  const last = new Map<string, { digit: number; n: number }>();
  let invalid = 0;
  for (const v of votes ?? []) {
    if (v.digit < 1 || v.digit > options.length) {
      invalid += 1;
      continue;
    }
    const prev = last.get(v.phone);
    last.set(v.phone, { digit: v.digit, n: prev ? prev.n + 1 : 1 });
  }
  let changed = 0;
  for (const v of last.values()) {
    counts[v.digit - 1] += 1;
    if (v.n > 1) changed += 1;
  }
  return { counts, voted: last.size, changed, invalid };
}

function questionView(q: QuestionRow, t: Tally, visible: boolean, category: LiveQuestionView["category"]): LiveQuestionView {
  const options = strArr(q.options);
  const max = Math.max(0, ...t.counts);
  return {
    id: q.id,
    text: q.text,
    options: options.map((label, i) => (visible ? { n: i + 1, label, count: t.counts[i], pct: t.voted ? round1((t.counts[i] / t.voted) * 100) : 0, leading: t.voted > 0 && t.counts[i] === max } : { n: i + 1, label })),
    reveal: asReveal(q.reveal),
    status: asStatus(q.status),
    challengeKey: q.challenge_key,
    category,
    openedAt: q.opened_at,
  };
}

/* ───────────────────────── questions ───────────────────────── */

async function questionRows(): Promise<QuestionRow[]> {
  const { data } = await createAdminClient().from("hackathon_live_questions").select("*").order("sort", { ascending: true }).order("created_at", { ascending: true });
  return data ?? [];
}

/** The question on the screen: the open one, else the one closed last. */
function currentOf(qs: QuestionRow[]): QuestionRow | null {
  return qs.find((q) => q.status === "open") ?? [...qs].filter((q) => q.status === "closed" && q.closed_at).sort((a, b) => Date.parse(b.closed_at!) - Date.parse(a.closed_at!))[0] ?? null;
}

function cleanOptions(raw: unknown): string[] {
  const options = (Array.isArray(raw) ? raw : []).map((o) => String(o ?? "").trim());
  if (options.length < LIVE_MIN_OPTIONS || options.length > LIVE_MAX_OPTIONS) fail(`לשאלה צריכות להיות בין ${LIVE_MIN_OPTIONS} ל-${LIVE_MAX_OPTIONS} אפשרויות`);
  return options.map((o, i) => o || `אפשרות ${i + 1}`);
}

export async function saveQuestion(input: { id?: string; text?: unknown; options?: unknown; reveal?: unknown; challengeKey?: unknown; criterionKey?: unknown }): Promise<QuestionRow> {
  const admin = createAdminClient();
  const text = String(input.text ?? "").trim().slice(0, 300);
  if (!text) fail("לשאלה חסר טקסט");
  const options = cleanOptions(input.options);
  const reveal = input.reveal === "end" ? "end" : "live";
  if (input.id) {
    const { data, error } = await admin.from("hackathon_live_questions").update({ text, options, reveal }).eq("id", input.id).select("*").maybeSingle();
    if (error || !data) fail(error?.message ?? "השאלה לא נמצאה");
    return data!;
  }
  const qs = await questionRows();
  const sort = qs.length ? Math.max(...qs.map((q) => q.sort)) + 1 : 1;
  const challenge_key = typeof input.challengeKey === "string" && input.challengeKey ? input.challengeKey : null;
  const criterion_key = typeof input.criterionKey === "string" && input.criterionKey ? input.criterionKey : null;
  const { data, error } = await admin.from("hackathon_live_questions").insert({ text, options, reveal, sort, challenge_key, criterion_key }).select("*").single();
  if (error) fail(error.message);
  return data!;
}

export async function deleteQuestion(id: string): Promise<void> {
  const admin = createAdminClient();
  const { data: q } = await admin.from("hackathon_live_questions").select("status").eq("id", id).maybeSingle();
  if (!q) fail("השאלה לא נמצאה");
  if (q!.status === "open") fail("אי אפשר למחוק שאלה שההצבעה עליה פתוחה - סגרי אותה קודם");
  await admin.from("hackathon_live_questions").delete().eq("id", id);
}

export async function moveQuestion(id: string, direction: "up" | "down"): Promise<void> {
  const qs = await questionRows();
  const idx = qs.findIndex((q) => q.id === id);
  if (idx === -1) fail("השאלה לא נמצאה");
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= qs.length) return;
  const [q] = qs.splice(idx, 1);
  qs.splice(target, 0, q);
  const admin = createAdminClient();
  await Promise.all(qs.map((x, i) => admin.from("hackathon_live_questions").update({ sort: i + 1 }).eq("id", x.id)));
}

export async function resetQuestion(id: string): Promise<void> {
  await createAdminClient().from("hackathon_live_votes").delete().eq("question_id", id);
}

export async function openQuestion(id: string): Promise<void> {
  const admin = createAdminClient();
  const qs = await questionRows();
  const q = qs.find((x) => x.id === id);
  if (!q) fail("השאלה לא נמצאה");
  const s = await loadSettings();
  // what is already waiting in the file belongs to the previous question
  await pollAudience().catch(() => {});
  const nowIso = new Date().toISOString();
  for (const other of qs) if (other.status === "open" && other.id !== id) await admin.from("hackathon_live_questions").update({ status: "closed", closed_at: nowIso }).eq("id", other.id);
  const token = s.yemot_token.trim();
  const ext = s.yemot_extension.trim();
  if (token && ext) {
    // every opening starts from an empty file; the phone accepts only this question's keys
    await archiveVotesFile(token, ext).catch(() => {});
    setAllowedKeys(token, ext, strArr(q!.options).length).catch(() => {});
  }
  await admin.from("hackathon_live_questions").update({ status: "open", opened_at: nowIso, closed_at: null }).eq("id", id);
}

export async function closeQuestion(): Promise<void> {
  const open = await openQuestionRow();
  if (!open) fail("אין הצבעה פתוחה");
  // the keypress of the last second still counts
  await pollAudience().catch(() => {});
  await createAdminClient().from("hackathon_live_questions").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", open!.id);
}

export async function questionControl(op: string, id?: string | null): Promise<void> {
  const qs = await questionRows();
  const cur = currentOf(qs);
  const idx = cur ? qs.findIndex((q) => q.id === cur.id) : -1;
  switch (op) {
    case "open":
      return openQuestion(id || cur?.id || fail("אין שאלה לפתוח"));
    case "close":
      return closeQuestion();
    case "toggle":
      if (cur?.status === "open") return closeQuestion();
      if (cur) return openQuestion(cur.id);
      return questionControl("next");
    case "next": {
      const target = qs[idx + 1];
      if (!target) fail(idx === -1 && !qs.length ? "אין שאלות" : "זו השאלה האחרונה");
      return openQuestion(target!.id);
    }
    case "prev": {
      if (idx <= 0) fail(idx === -1 ? "אין שאלה פעילה" : "זו השאלה הראשונה");
      return openQuestion(qs[idx - 1].id);
    }
    case "goto":
      return openQuestion(id || fail("חסר מזהה שאלה"));
    case "archive": {
      const s = await loadSettings();
      if (!s.yemot_token.trim() || !s.yemot_extension.trim()) fail("לא הוגדר חיבור לימות");
      await pollAudience().catch(() => {});
      await archiveVotesFile(s.yemot_token.trim(), s.yemot_extension.trim());
      return;
    }
    default:
      fail("פעולה לא מוכרת");
  }
}

/* ───────────────────────── finals ───────────────────────── */

async function challengeRows(): Promise<ChallengeRow[]> {
  const { data } = await createAdminClient().from("hackathon_live_challenges").select("*").order("sort", { ascending: true });
  return data ?? [];
}

async function challengeRow(key: string): Promise<ChallengeRow> {
  const { data } = await createAdminClient().from("hackathon_live_challenges").select("*").eq("key", key).maybeSingle();
  if (!data) fail("אתגר לא מוכר");
  return data!;
}

async function finalistsOf(key: string): Promise<FinalistRow[]> {
  const { data } = await createAdminClient().from("hackathon_live_finalists").select("*").eq("challenge_key", key).order("n", { ascending: true });
  return data ?? [];
}

/** The audience questions of a challenge - one per audience criterion. */
const audienceQuestionsOf = (qs: QuestionRow[], key: string) => qs.filter((q) => q.challenge_key === key && q.criterion_key);

export async function saveChallenge(key: string, patch: { name?: unknown; finalists?: unknown }): Promise<void> {
  const admin = createAdminClient();
  const ch = await challengeRow(key);
  if (patch.name !== undefined) {
    const name = String(patch.name ?? "").trim().slice(0, 80);
    if (name) await admin.from("hackathon_live_challenges").update({ name }).eq("key", key);
  }
  if (patch.finalists !== undefined) {
    if (ch.status === "judging") fail("אי אפשר לשנות את הסופיות בזמן שהשיפוט פתוח - סגרי אותו קודם");
    const list = (Array.isArray(patch.finalists) ? patch.finalists : []) as Record<string, unknown>[];
    const next = list
      .map((f) => ({ name: String(f?.name ?? "").trim().slice(0, 120), team: String(f?.team ?? "").trim().slice(0, 200), teamKey: typeof f?.teamKey === "string" ? f.teamKey : null }))
      .filter((f) => f.name);
    if (next.length > LIVE_MAX_FINALISTS) fail(`עד ${LIVE_MAX_FINALISTS} סופיות לאתגר - מקשי הטלפון 1 עד 9`);
    if (new Set(next.map((f) => f.name)).size !== next.length) fail("שתי סופיות עם אותו שם");
    const existing = await finalistsOf(key);
    // a finalist that stays keeps her id (and the judges' scores); the rest are replaced
    const keep = new Map<string, FinalistRow>();
    for (const f of next) {
      const prev = existing.find((e) => e.name === f.name && !keep.has(e.id));
      if (prev) keep.set(prev.id, prev);
    }
    const gone = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
    if (gone.length) await admin.from("hackathon_live_finalists").delete().in("id", gone);
    // free the slot numbers before re-numbering (unique challenge_key+n)
    for (const [i, e] of [...keep.values()].entries()) await admin.from("hackathon_live_finalists").update({ n: 100 + i }).eq("id", e.id);
    for (const [i, f] of next.entries()) {
      const prev = existing.find((e) => e.name === f.name && keep.has(e.id));
      if (prev) await admin.from("hackathon_live_finalists").update({ n: i + 1, team: f.team, team_key: f.teamKey }).eq("id", prev.id);
      else await admin.from("hackathon_live_finalists").insert({ challenge_key: key, n: i + 1, name: f.name, team: f.team, team_key: f.teamKey });
    }
    if (ch.current_finalist_id && !keep.has(ch.current_finalist_id)) await admin.from("hackathon_live_challenges").update({ current_finalist_id: null }).eq("key", key);
    // audience questions that already exist follow the finalists
    if (audienceQuestionsOf(await questionRows(), key).length && next.length >= LIVE_MIN_FINALISTS) await syncAudienceQuestions(key).catch(() => {});
  }
}

export async function saveJudges(list: unknown): Promise<void> {
  const admin = createAdminClient();
  const rows = (Array.isArray(list) ? list : []) as Record<string, unknown>[];
  const challenges = new Set((await challengeRows()).map((c) => c.key));
  const { data: existing } = await admin.from("hackathon_live_judges").select("id");
  const keep = new Set<string>();
  for (const [i, raw] of rows.entries()) {
    const name = String(raw?.name ?? "").trim().slice(0, 80);
    if (!name) continue;
    const challenge = String(raw?.challengeKey ?? "").trim();
    if (challenge && !challenges.has(challenge)) fail(`אתגר לא מוכר: ${challenge}`);
    const id = typeof raw?.id === "string" && raw.id ? raw.id : null;
    if (id && (existing ?? []).some((e) => e.id === id)) {
      await admin.from("hackathon_live_judges").update({ name, challenge_key: challenge || null, sort: i }).eq("id", id);
      keep.add(id);
    } else {
      const { data } = await admin.from("hackathon_live_judges").insert({ name, challenge_key: challenge || null, sort: i }).select("id").single();
      if (data) keep.add(data.id);
    }
  }
  const gone = (existing ?? []).filter((e) => !keep.has(e.id)).map((e) => e.id);
  if (gone.length) await admin.from("hackathon_live_judges").delete().in("id", gone);
}

/**
 * The phone questions of a challenge - one per audience criterion, in the
 * criteria's order, each with the finalists as its options. Created the first
 * time, kept in step afterwards; a criterion that is no longer the audience's
 * loses its question (unless it is open right now).
 */
export async function syncAudienceQuestions(key: string): Promise<QuestionRow[]> {
  const admin = createAdminClient();
  const ch = await challengeRow(key);
  const finalists = await finalistsOf(key);
  if (finalists.length < LIVE_MIN_FINALISTS) fail(`צריך לפחות ${LIVE_MIN_FINALISTS} סופיות כדי לפתוח הצבעת קהל`);
  const criteria = audienceCriteria(criteriaOf(await loadSettings()));
  if (!criteria.length) fail("אין קריטריונים לקהל - סמני ״קהל״ לפחות בקריטריון אחד בשקלול");
  const options = finalists.map((f) => f.name);
  let qs = await questionRows();
  const mine = audienceQuestionsOf(qs, key);
  for (const q of mine) if (!criteria.some((c) => c.key === q.criterion_key) && q.status !== "open") await admin.from("hackathon_live_questions").delete().eq("id", q.id);
  let sort = qs.length ? Math.max(...qs.map((q) => q.sort)) : 0;
  for (const c of criteria) {
    const text = `${c.label} - ${ch.name}: הקישו את מספר הפרויקט`;
    const existing = mine.find((q) => q.criterion_key === c.key);
    if (existing) await admin.from("hackathon_live_questions").update({ text, options }).eq("id", existing.id);
    else {
      sort += 1;
      await admin.from("hackathon_live_questions").insert({ text, options, reveal: "end", sort, challenge_key: key, criterion_key: c.key });
    }
  }
  qs = await questionRows();
  return audienceQuestionsOf(qs, key);
}

export async function finalsControl(op: string, key: string | null, body: { finalistId?: unknown } = {}): Promise<void> {
  const admin = createAdminClient();
  if (op === "clear") {
    await admin.from("hackathon_live_settings").update({ active_challenge: null }).eq("id", 1);
    return;
  }
  if (!key) fail("חסר אתגר");
  const ch = await challengeRow(key!);
  switch (op) {
    case "open": {
      const finalists = await finalistsOf(ch.key);
      if (finalists.length < LIVE_MIN_FINALISTS) fail(`צריך לפחות ${LIVE_MIN_FINALISTS} סופיות כדי לפתוח שיפוט`);
      await admin.from("hackathon_live_challenges").update({ status: "judging" }).eq("key", ch.key);
      await admin.from("hackathon_live_settings").update({ active_challenge: ch.key }).eq("id", 1);
      const mine = await syncAudienceQuestions(ch.key);
      // the first audience vote of the challenge opens on the phone; "הבאה" moves to the next category
      if (!mine.some((q) => q.status === "open") && mine[0]) await openQuestion(mine[0].id);
      return;
    }
    case "close": {
      await admin.from("hackathon_live_challenges").update({ status: "closed" }).eq("key", ch.key);
      const open = await openQuestionRow();
      if (open?.challenge_key === ch.key) await closeQuestion();
      return;
    }
    case "reveal":
      await admin.from("hackathon_live_challenges").update({ revealed: true }).eq("key", ch.key);
      return;
    case "hide":
      await admin.from("hackathon_live_challenges").update({ revealed: false }).eq("key", ch.key);
      return;
    case "show":
      await admin.from("hackathon_live_settings").update({ active_challenge: ch.key }).eq("id", 1);
      return;
    case "current": {
      const id = typeof body.finalistId === "string" && body.finalistId ? body.finalistId : null;
      if (id && !(await finalistsOf(ch.key)).some((f) => f.id === id)) fail("הסופית לא נמצאה");
      await admin.from("hackathon_live_challenges").update({ current_finalist_id: id }).eq("key", ch.key);
      return;
    }
    case "reset": {
      if (ch.status === "judging") fail("סגרי את השיפוט לפני האיפוס");
      const ids = (await finalistsOf(ch.key)).map((f) => f.id);
      if (ids.length) await admin.from("hackathon_live_scores").delete().in("finalist_id", ids);
      const mine = audienceQuestionsOf(await questionRows(), ch.key).map((q) => q.id);
      if (mine.length) await admin.from("hackathon_live_votes").delete().in("question_id", mine);
      await admin.from("hackathon_live_challenges").update({ status: "idle", revealed: false }).eq("key", ch.key);
      return;
    }
    case "question":
      await syncAudienceQuestions(ch.key);
      return;
    default:
      fail("פעולה לא מוכרת");
  }
}

/* ───────────────────────── judges ───────────────────────── */

/**
 * The judges' entrance: a name and a challenge, guarded by the judges' code.
 * The same name on the same challenge (spaces and case aside) gets her existing
 * row back, so a refresh or a second phone continues the same scores.
 */
export async function registerJudge({ name, challengeKey, code }: { name: string; challengeKey: string; code: string }): Promise<{ token: string; name: string }> {
  const admin = createAdminClient();
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 60);
  if (clean.length < 2) fail("כתבי את שמך המלא");
  const s = await loadSettings();
  const want = s.judge_code.trim();
  const given = code.trim();
  if (!want || given.length !== want.length || !given.split("").every((ch, i) => ch === want[i])) fail("קוד השופטות שגוי - בקשי אותו מהמארגנת");
  const ch = await challengeRow(challengeKey);
  const { data: existing } = await admin.from("hackathon_live_judges").select("*").eq("challenge_key", ch.key);
  const same = (existing ?? []).find((j) => j.name.replace(/\s+/g, " ").trim().toLowerCase() === clean.toLowerCase());
  if (same) return { token: same.token, name: same.name };
  const { data, error } = await admin.from("hackathon_live_judges").insert({ name: clean, challenge_key: ch.key, sort: (existing ?? []).length }).select("token, name").single();
  if (error || !data) fail(error?.message ?? "הרישום נכשל");
  return { token: data!.token, name: data!.name };
}

async function judgeByToken(token: string): Promise<JudgeRow | null> {
  const t = String(token || "").trim();
  if (!/^[a-f0-9]{16,64}$/i.test(t)) return null;
  const { data } = await createAdminClient().from("hackathon_live_judges").select("*").eq("token", t).maybeSingle();
  return data ?? null;
}

export async function setJudgeScore(token: string, finalistId: string, scores: unknown): Promise<{ scores: Record<string, number>; total: number; complete: boolean }> {
  const admin = createAdminClient();
  const judge = await judgeByToken(token);
  if (!judge) fail("מפתח השופטת לא מוכר");
  const { data: finalist } = await admin.from("hackathon_live_finalists").select("*").eq("id", finalistId).maybeSingle();
  if (!finalist) fail("הסופית לא נמצאה");
  if (finalist!.challenge_key !== judge!.challenge_key) fail("הסופית הזו לא באתגר שלך");
  const ch = await challengeRow(finalist!.challenge_key);
  if (ch.status !== "judging") fail(ch.status === "closed" ? "השיפוט באתגר הזה נסגר" : "השיפוט באתגר הזה עוד לא נפתח");
  const criteria = criteriaOf(await loadSettings());
  const clean: Record<string, number> = {};
  const raw = (scores && typeof scores === "object" ? scores : {}) as Record<string, unknown>;
  for (const c of judgesCriteria(criteria)) {
    const v = raw[c.key];
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > LIVE_SCALE) fail(`ציון ב"${c.label}" חייב להיות בין 1 ל-${LIVE_SCALE}`);
    clean[c.key] = n;
  }
  const { error } = await admin.from("hackathon_live_scores").upsert({ judge_id: judge!.id, finalist_id: finalistId, scores: clean, updated_at: new Date().toISOString() }, { onConflict: "judge_id,finalist_id" });
  if (error) fail(error.message);
  const t = judgeTotal(clean, criteria);
  return { scores: clean, total: t.total, complete: t.complete };
}

export async function judgeView(token: string): Promise<LiveJudgeView | null> {
  const judge = await judgeByToken(token);
  if (!judge) return null;
  const s = await loadSettings();
  const criteria = criteriaOf(s);
  const mineCriteria = judgesCriteria(criteria);
  const ch = judge.challenge_key ? await challengeRow(judge.challenge_key).catch(() => null) : null;
  const finalists = ch ? await finalistsOf(ch.key) : [];
  const { data: mine } = finalists.length ? await createAdminClient().from("hackathon_live_scores").select("finalist_id, scores").eq("judge_id", judge.id) : { data: [] as Pick<ScoreRow, "finalist_id" | "scores">[] };
  const scoreOf = new Map((mine ?? []).map((m) => [m.finalist_id, (m.scores ?? {}) as Record<string, number>]));
  return {
    ok: true,
    judge: { id: judge.id, name: judge.name },
    challenge: ch ? { key: ch.key, name: ch.name, org: ch.org, logos: strArr(ch.logos), status: asChStatus(ch.status), currentId: ch.current_finalist_id } : null,
    criteria: mineCriteria,
    scale: LIVE_SCALE,
    maxTotal: weightSum(mineCriteria),
    finalists: finalists.map((f) => {
      const sc = scoreOf.get(f.id) ?? {};
      const t = judgeTotal(sc, criteria);
      return { id: f.id, n: f.n, name: f.name, team: f.team, scores: sc, total: t.total, complete: t.complete, filled: t.filled };
    }),
    updatedAt: new Date().toISOString(),
  };
}

/* ───────────────────────── the boards ───────────────────────── */

interface BoardCtx {
  settings: SettingsRow;
  criteria: LiveCriterion[];
  judges: JudgeRow[];
  scores: ScoreRow[];
  questions: QuestionRow[];
  challenges: ChallengeRow[];
}

async function boardCtx(): Promise<BoardCtx> {
  const admin = createAdminClient();
  const [settings, questions, challenges, { data: judges }, { data: scores }] = await Promise.all([
    loadSettings(),
    questionRows(),
    challengeRows(),
    admin.from("hackathon_live_judges").select("*").order("sort", { ascending: true }).order("created_at", { ascending: true }),
    admin.from("hackathon_live_scores").select("*"),
  ]);
  return { settings, criteria: criteriaOf(settings), judges: judges ?? [], scores: scores ?? [], questions, challenges: challenges ?? [] };
}

async function boardOf(ch: ChallengeRow, ctx: BoardCtx): Promise<{ rows: LiveFinalistRow[]; judgesTotal: number; categories: LiveCategoryView[] }> {
  const finalists = await finalistsOf(ch.key);
  const judges = ctx.judges.filter((j) => j.challenge_key === ch.key);
  const ac = audienceCriteria(ctx.criteria);
  const mine = audienceQuestionsOf(ctx.questions, ch.key);
  // one tally per audience criterion
  const tallies = new Map<string, Tally>();
  for (const c of ac) {
    const q = mine.find((x) => x.criterion_key === c.key);
    if (q) tallies.set(c.key, await tallyOf(q));
  }
  const rows: LiveFinalistRow[] = finalists.map((f, i) => {
    const per = judges.map((j) => {
      const rec = ctx.scores.find((s) => s.judge_id === j.id && s.finalist_id === f.id);
      const t = rec ? judgeTotal((rec.scores ?? {}) as Record<string, number>, ctx.criteria) : null;
      return { judgeId: j.id, name: j.name, total: t && t.complete ? t.total : null, filled: t ? t.filled : 0 };
    });
    const done = per.filter((p) => p.total !== null);
    const judgesScore = done.length ? round1(done.reduce((s, p) => s + (p.total as number), 0) / done.length) : null;
    const audience: LiveFinalistRow["audience"] = {};
    let audienceSum: number | null = null;
    for (const c of ac) {
      const t = tallies.get(c.key);
      const count = t ? t.counts[i] ?? 0 : 0;
      const voted = t ? t.voted : 0;
      const maxVotes = t ? Math.max(0, ...t.counts) : 0;
      const score = t && voted > 0 ? round1((ctx.settings.audience_mode === "share" ? count / voted : maxVotes ? count / maxVotes : 0) * c.weight) : null;
      if (score !== null) audienceSum = (audienceSum ?? 0) + score;
      audience[c.key] = { count, pct: voted ? round1((count / voted) * 100) : 0, score, leading: voted > 0 && count === maxVotes };
    }
    const total = judgesScore === null && audienceSum === null ? null : round1((judgesScore ?? 0) + (audienceSum ?? 0));
    return { id: f.id, n: f.n, name: f.name, team: f.team, judges: per, judged: done.length, judgesTotal: judges.length, judgesScore, audience, total, rank: null };
  });
  const ranked = rows.filter((r) => r.total !== null).sort((a, b) => (b.total as number) - (a.total as number) || (b.judgesScore ?? 0) - (a.judgesScore ?? 0));
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });
  const categories: LiveCategoryView[] = ac.map((c) => {
    const t = tallies.get(c.key);
    const voted = t ? t.voted : 0;
    const max = t ? Math.max(0, ...t.counts) : 0;
    const leaders = t && voted > 0 ? t.counts.map((n, i) => (n === max ? i : -1)).filter((i) => i >= 0) : [];
    return { key: c.key, label: c.label, weight: c.weight, voted, winner: leaders.length === 1 ? (finalists[leaders[0]]?.name ?? null) : null };
  });
  return { rows, judgesTotal: judges.length, categories };
}

async function finalsView(ctx: BoardCtx, admin: boolean): Promise<LiveFinalsView> {
  const key = ctx.settings.active_challenge;
  if (!key) return { active: null };
  const ch = ctx.challenges.find((c) => c.key === key);
  if (!ch) return { active: null };
  const b = await boardOf(ch, ctx);
  const hidden = !admin && ctx.settings.reveal === "end" && !ch.revealed;
  return {
    active: key,
    name: ch.name,
    org: ch.org,
    logos: strArr(ch.logos),
    status: asChStatus(ch.status),
    revealed: ch.revealed,
    reveal: asReveal(ctx.settings.reveal),
    hidden,
    currentId: ch.current_finalist_id,
    weights: weightsOf(ctx.criteria),
    judgesTotal: b.judgesTotal,
    categories: hidden ? b.categories.map((c) => ({ ...c, winner: null })) : b.categories,
    finalists: b.rows.map((f) =>
      hidden ? { id: f.id, n: f.n, name: f.name, team: f.team, judged: f.judged, judgesTotal: f.judgesTotal, judgesScore: null, audience: {}, total: null, rank: null } : { id: f.id, n: f.n, name: f.name, team: f.team, judged: f.judged, judgesTotal: f.judgesTotal, judgesScore: f.judgesScore, audience: f.audience, total: f.total, rank: f.rank }
    ),
  };
}

function categoryOf(q: QuestionRow | null, ctx: BoardCtx): LiveQuestionView["category"] {
  if (!q?.criterion_key) return null;
  const c = ctx.criteria.find((x) => x.key === q.criterion_key);
  const ch = ctx.challenges.find((x) => x.key === q.challenge_key);
  return { key: q.criterion_key, label: c?.label ?? q.criterion_key, challenge: ch?.name ?? "" };
}

/** What the hall sees. `poll` pulls the phone file first (one caller per 1.5s actually does). */
export async function displayView({ poll = true, admin = false }: { poll?: boolean; admin?: boolean } = {}): Promise<LiveDisplayView> {
  if (poll) await pollAudience().catch(() => {});
  const ctx = await boardCtx();
  const cur = currentOf(ctx.questions);
  const tally = cur ? await tallyOf(cur) : null;
  const visible = !cur || admin || asReveal(cur.reveal) === "live" || cur.status !== "open";
  return {
    event: { name: ctx.settings.event_name, phone: ctx.settings.phone_display, theme: ctx.settings.theme === "dark" ? "dark" : "light" },
    question: cur && tally ? questionView(cur, tally, visible, categoryOf(cur, ctx)) : null,
    resultsVisible: visible,
    voted: tally?.voted ?? 0,
    changed: tally?.changed ?? 0,
    invalid: tally?.invalid ?? 0,
    connected: ctx.settings.connected,
    finals: await finalsView(ctx, admin),
    health: { configured: !!(ctx.settings.yemot_token.trim() && ctx.settings.yemot_extension.trim()), lastPollAt: ctx.settings.last_poll_at, error: ctx.settings.poll_error },
    updatedAt: new Date().toISOString(),
  };
}

export async function adminView({ poll = true }: { poll?: boolean } = {}): Promise<LiveAdminView> {
  const base = await displayView({ poll, admin: true });
  const ctx = await boardCtx();
  const cur = currentOf(ctx.questions);
  const challenges: LiveAdminChallenge[] = [];
  for (const ch of ctx.challenges) {
    const b = await boardOf(ch, ctx);
    const raw = await finalistsOf(ch.key);
    challenges.push({
      key: ch.key,
      name: ch.name,
      org: ch.org,
      logos: strArr(ch.logos),
      status: asChStatus(ch.status),
      revealed: ch.revealed,
      currentId: ch.current_finalist_id,
      judgesTotal: b.judgesTotal,
      categories: b.categories,
      finalists: b.rows,
      finalistsRaw: raw.map((f) => ({ id: f.id, n: f.n, name: f.name, team: f.team, teamKey: f.team_key })),
    });
  }
  const questions = [];
  for (const q of ctx.questions) {
    const t = await tallyOf(q);
    questions.push({ id: q.id, text: q.text, options: strArr(q.options), sort: q.sort, challengeKey: q.challenge_key, criterionKey: q.criterion_key, status: asStatus(q.status), reveal: asReveal(q.reveal), voted: t.voted, current: cur?.id === q.id });
  }
  return {
    ...base,
    settings: {
      eventName: ctx.settings.event_name,
      phoneDisplay: ctx.settings.phone_display,
      hasToken: !!ctx.settings.yemot_token.trim(),
      yemotExtension: ctx.settings.yemot_extension,
      judgeCode: ctx.settings.judge_code,
      weights: weightsOf(ctx.criteria),
      audienceMode: (ctx.settings.audience_mode === "share" ? "share" : "leader") as LiveAudienceMode,
      reveal: asReveal(ctx.settings.reveal),
      theme: ctx.settings.theme === "dark" ? "dark" : "light",
      criteria: ctx.criteria,
      activeChallenge: ctx.settings.active_challenge,
    },
    questions,
    challenges,
    judges: ctx.judges.map((j) => ({
      id: j.id,
      name: j.name,
      challengeKey: j.challenge_key,
      token: j.token,
      scored: ctx.scores.filter((sc) => sc.judge_id === j.id && judgeTotal((sc.scores ?? {}) as Record<string, number>, ctx.criteria).complete).length,
      createdAt: j.created_at,
    })),
  };
}

export async function exportCsv(): Promise<string> {
  const ctx = await boardCtx();
  const ac = audienceCriteria(ctx.criteria);
  const esc = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  const rows: unknown[][] = [["אתגר", "מס׳", "פרויקט", "צוות", "דירוג", "שופטות (פירוט)", "ציון שופטות", ...ac.flatMap((c) => [`${c.label} - קולות`, `${c.label} - נקודות`]), "ציון סופי"]];
  for (const ch of ctx.challenges) {
    const b = await boardOf(ch, ctx);
    for (const f of b.rows) rows.push([ch.name, f.n, f.name, f.team, f.rank, (f.judges ?? []).map((j) => `${j.name}: ${j.total === null ? "—" : j.total}`).join(" | "), f.judgesScore, ...ac.flatMap((c) => [f.audience[c.key]?.count ?? 0, f.audience[c.key]?.score ?? ""]), f.total]);
  }
  rows.push([]);
  rows.push(["שאלה", "אפשרות", "מקש", "הצבעות", "אחוז", "סה״כ הצביעו"]);
  for (const q of ctx.questions) {
    const t = await tallyOf(q);
    strArr(q.options).forEach((label, i) => rows.push([q.text, label, i + 1, t.counts[i], t.voted ? round1((t.counts[i] / t.voted) * 100) + "%" : "0%", t.voted]));
  }
  return "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
