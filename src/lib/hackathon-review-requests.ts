// בקשות השלמה מצוותי ההאקתון (the owner, 24/10): a team whose project could
// not be reviewed (login, product down, video unreachable, repo private) gets a
// personal mail with what is missing and answers on her submission page by
// the deadline. One row per team; the admin sees the mail and the answer.
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { sendResendEmail } from "@/lib/email/resend";
import { hackathonReviewRequestEmail } from "@/lib/email/templates";
import { getSiteUrl } from "@/lib/site";
import { dropStaleMirror } from "@/lib/hackathon-drive";
import { CHALLENGES } from "@/app/hackathon-2026/shared";

export type { RequestItem, RequestKind, ReviewRequest, ReviewResponse } from "@/lib/hackathon-review-shared";
export { KIND_ASK, KIND_LABEL, REQUEST_KINDS } from "@/lib/hackathon-review-shared";
import { KIND_LABEL, REQUEST_KINDS, type RequestItem, type RequestKind, type ReviewRequest, type ReviewResponse } from "@/lib/hackathon-review-shared";

interface Row {
  id: string;
  team_key: string;
  items: unknown;
  due_at: string;
  email_subject: string | null;
  email_html: string | null;
  sent_at: string | null;
  sent_to: string[] | null;
  send_error: string | null;
  responded_at: string | null;
  responded_by: string | null;
  response: unknown;
  created_at: string;
}

function isKind(k: unknown): k is RequestKind {
  return typeof k === "string" && (REQUEST_KINDS as string[]).includes(k);
}
function toItems(raw: unknown): RequestItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (x && typeof x === "object" ? (x as { kind?: unknown; detail?: unknown }) : null))
    .filter((x): x is { kind: RequestKind; detail?: unknown } => !!x && isKind(x.kind))
    .map((x) => ({ kind: x.kind, detail: typeof x.detail === "string" ? x.detail : "" }));
}
function toRequest(r: Row): ReviewRequest {
  return {
    id: r.id,
    teamKey: r.team_key,
    items: toItems(r.items),
    dueAt: r.due_at,
    emailSubject: r.email_subject,
    emailHtml: r.email_html,
    sentAt: r.sent_at,
    sentTo: r.sent_to ?? [],
    sendError: r.send_error,
    respondedAt: r.responded_at,
    respondedBy: r.responded_by,
    response: r.response && typeof r.response === "object" ? (r.response as ReviewResponse) : null,
    createdAt: r.created_at,
  };
}

export async function loadReviewRequest(teamKey: string): Promise<ReviewRequest | null> {
  const { data } = await createAdminClient().from("hackathon_review_requests").select("*").eq("team_key", teamKey).maybeSingle();
  return data ? toRequest(data as Row) : null;
}

export async function loadReviewRequests(): Promise<ReviewRequest[]> {
  const { data } = await createAdminClient().from("hackathon_review_requests").select("*").order("created_at", { ascending: true }).limit(2000);
  return ((data ?? []) as Row[]).map(toRequest);
}

/** Tomorrow 23:59 in Israel, as the default deadline for a request created today. */
export function tomorrowEndOfDayIsrael(now = new Date()): Date {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(now); // yyyy-mm-dd
  const [y, m, d] = day.split("-").map(Number);
  // 23:59 Israel: try both offsets (IDT +3 / IST +2) and keep the one whose local time reads 23:59
  for (const off of [2, 3]) {
    const candidate = new Date(Date.UTC(y, m - 1, d + 1, 23 - off, 59, 0));
    const local = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hour12: false }).format(candidate);
    if (local === "23:59") return candidate;
  }
  return new Date(Date.UTC(y, m - 1, d + 1, 21, 59, 0));
}

/** Create or extend a team's request: a new kind is added, an existing kind's detail is replaced. */
export async function upsertReviewRequest(teamKey: string, items: RequestItem[], dueAt: Date, byId: string | null): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const existing = await loadReviewRequest(teamKey);
  const merged: RequestItem[] = existing ? [...existing.items] : [];
  for (const it of items) {
    const i = merged.findIndex((m) => m.kind === it.kind);
    if (i >= 0) merged[i] = it;
    else merged.push(it);
  }
  const { error } = existing
    ? await admin.from("hackathon_review_requests").update({ items: merged as unknown as Json }).eq("id", existing.id)
    : await admin.from("hackathon_review_requests").insert({ team_key: teamKey, items: merged as unknown as Json, due_at: dueAt.toISOString(), created_by: byId });
  return error ? { error: error.message } : {};
}

export async function deleteReviewRequest(id: string): Promise<{ error?: string }> {
  const { error } = await createAdminClient().from("hackathon_review_requests").delete().eq("id", id);
  return error ? { error: error.message } : {};
}

export interface TeamPerson {
  id: string;
  name: string;
  firstName: string;
  email: string | null;
}

/** The women behind a team key, with the address each one gets mail at. */
export async function teamPeople(teamKey: string): Promise<TeamPerson[]> {
  const ids = teamKey.split("+").filter(Boolean);
  if (!ids.length) return [];
  const admin = createAdminClient();
  const [{ data: profs }, { data: mails }] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", ids),
    admin.rpc("member_emails", { p_ids: ids }),
  ]);
  const emailOf = new Map(((mails ?? []) as { id: string; email: string | null }[]).map((m) => [m.id, m.email]));
  return ids
    .map((id) => {
      const p = (profs ?? []).find((x) => x.id === id);
      const name = (p?.full_name ?? "").trim();
      return { id, name, firstName: name.split(/\s+/)[0] || name, email: emailOf.get(id) ?? null };
    })
    .filter((p) => p.name);
}

const DUE_FMT = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
const DAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });

/** "מחר, 25.10 בשעה 23:59" when the deadline is tomorrow (Israel), otherwise the date alone. */
export function dueText(dueAt: string | Date, now = new Date()): string {
  const d = new Date(dueAt);
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const [date, time] = DUE_FMT.format(d).split(",").map((s) => s.trim());
  const when = `${date} בשעה ${time}`;
  if (DAY_FMT.format(d) === DAY_FMT.format(tomorrow)) return `מחר, ${when}`;
  if (DAY_FMT.format(d) === DAY_FMT.format(now)) return `היום, ${when}`;
  return when;
}

export function buildReviewRequestMail(req: Pick<ReviewRequest, "items" | "dueAt">, person: Pick<TeamPerson, "firstName">, challengeKey: string, isPair: boolean) {
  const challenge = CHALLENGES.find((c) => c.key === challengeKey);
  return hackathonReviewRequestEmail({
    firstName: person.firstName,
    isPair,
    challengeShort: challenge?.short ?? challengeKey,
    items: req.items.map((it) => ({ label: KIND_LABEL[it.kind], detail: it.detail, kind: it.kind })),
    dueText: dueText(req.dueAt),
    url: `${getSiteUrl()}/hackathon/submit#review-request`,
  });
}

export interface SendOutcome {
  id: string;
  teamKey: string;
  sent: string[];
  errors: string[];
}

/** Mail one request to every woman of the team - personally, by her first name - and record what went out. */
export async function sendReviewRequest(id: string): Promise<SendOutcome> {
  const admin = createAdminClient();
  const { data } = await admin.from("hackathon_review_requests").select("*").eq("id", id).maybeSingle();
  if (!data) return { id, teamKey: "", sent: [], errors: ["הבקשה לא נמצאה"] };
  const req = toRequest(data as Row);
  const [{ data: sub }, people] = await Promise.all([
    admin.from("hackathon_submissions").select("challenge_key").eq("team_key", req.teamKey).maybeSingle(),
    teamPeople(req.teamKey),
  ]);
  const challengeKey = sub?.challenge_key ?? "";
  const sent: string[] = [];
  const errors: string[] = [];
  let subject: string | null = null;
  let html: string | null = null;
  for (const p of people) {
    const mail = buildReviewRequestMail(req, p, challengeKey, people.length > 1);
    subject ??= mail.subject;
    html ??= mail.html;
    if (!p.email) {
      errors.push(`${p.name}: אין כתובת מייל`);
      continue;
    }
    const r = await sendResendEmail({ to: p.email, subject: mail.subject, html: mail.html, essential: true });
    if (r.ok) sent.push(p.email);
    else errors.push(`${p.name}: ${r.error ?? "send_failed"}`);
  }
  if (!people.length) errors.push("לא נמצאו חברות צוות");
  await admin
    .from("hackathon_review_requests")
    .update({
      email_subject: subject,
      email_html: html,
      sent_at: sent.length ? new Date().toISOString() : req.sentAt,
      sent_to: sent.length ? sent : req.sentTo,
      send_error: errors.length ? errors.join(" | ").slice(0, 1000) : null,
    })
    .eq("id", id);
  return { id, teamKey: req.teamKey, sent, errors };
}

/** The four wordings, one sample each, so the owner can read them before anything goes out (24/10). */
export const SAMPLE_ITEMS: Record<RequestKind, RequestItem> = {
  login: { kind: "login", detail: "המערכת מבקשת שם משתמש וסיסמה, ובהגשה לא צורפו פרטי משתמש להדגמה." },
  product: { kind: "product", detail: "בכתובת שבהגשה השרת לא עונה (connection refused), גם אחרי ניסיון חוזר." },
  video: { kind: "video", detail: "הקובץ בדרייב לא פתוח ל״כל מי שיש את הקישור״, ולכן לא הצלחנו לצפות בו." },
  repo: { kind: "repo", detail: "הריפו שצורף מחזיר 404 - כנראה פרטי, או שהכתובת השתנתה." },
};

export async function sendSampleReviewRequest(kind: RequestKind, to: string, firstName: string): Promise<{ ok: boolean; error?: string; subject: string }> {
  const mail = buildReviewRequestMail({ items: [SAMPLE_ITEMS[kind]], dueAt: tomorrowEndOfDayIsrael().toISOString() }, { firstName }, "strauss", false);
  const r = await sendResendEmail({ to, subject: `[דוגמה - ${KIND_LABEL[kind]}] ${mail.subject}`, html: mail.html, essential: true });
  return { ok: r.ok, error: r.error, subject: mail.subject };
}

/** The team's answer: stored on the request, and the corrected links applied to the submission itself. */
export async function saveReviewResponse(teamKey: string, byId: string, response: ReviewResponse): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const req = await loadReviewRequest(teamKey);
  if (!req) return { error: "אין בקשה פתוחה לצוות שלך." };
  const { error } = await admin.from("hackathon_review_requests").update({ response: response as unknown as Json, responded_at: new Date().toISOString(), responded_by: byId }).eq("id", req.id);
  if (error) return { error: error.message };
  const patch: { product_url?: string; repo_url?: string; video_url?: string } = {};
  if (response.product_url) patch.product_url = response.product_url;
  if (response.repo_url) patch.repo_url = response.repo_url;
  if (response.video_url) {
    patch.video_url = response.video_url;
    await dropStaleMirror(teamKey); // the old copy no longer matches - the sync copies the new link
  }
  if (Object.keys(patch).length) {
    const { error: e2 } = await admin.from("hackathon_submissions").update(patch).eq("team_key", teamKey);
    if (e2) return { error: e2.message };
  }
  return {};
}
