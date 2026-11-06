import { createAdminClient } from "@/lib/supabase/admin";

/*
  משובים על ההאקתון (the owner, 6.11): ״תעבור בצ'אטים של הצוות ובהודעות הכלליות
  בצוות ותחפש משובים על ההאקתון או ארוע ההאקתון … בתוך האדמין כשנכנסים לפרופיל
  שאפשר יהיה לראות בלחיצה משובים להאקתון גם בפרופיל שלנו וגם בראש דף ההגשה …
  על כל משוב יהיה כתוב מקור ואם יהיה כמה רשימה״.

  One row per quote in hackathon_feedback_notes, gathered by tools/hackathon-feedback-load.mjs
  (the staff chats, the WhatsApp inbox, the forum, the ״יש לך בקשה?״ form, the
  personal answers of the submission, the replies to the review-request mail, mail)
  or typed by an admin. Service role only - members never read this table.
*/

export type FeedbackSource = "chat" | "whatsapp" | "forum" | "request" | "submission" | "review" | "email" | "manual";
export type FeedbackAudience = "submitter" | "participant" | "other";
export type FeedbackKind = "praise" | "criticism" | "suggestion" | "mixed" | "reflection" | "borderline";

export interface FeedbackNote {
  id: string;
  profileId: string | null;
  teamKey: string | null;
  displayName: string;
  audience: FeedbackAudience;
  source: FeedbackSource;
  sourceRef: string | null;
  /** An admin link to where it was said (the chat thread, the post, the WhatsApp contact…). */
  sourceUrl: string | null;
  kind: FeedbackKind;
  topic: string | null;
  body: string;
  writtenAt: string;
  hiddenAt: string | null;
}

export const SOURCE_LABELS: Record<FeedbackSource, string> = {
  chat: "צ׳אט עם הצוות",
  whatsapp: "וואטסאפ",
  forum: "פורום הקהילה",
  request: "טופס ״יש לך בקשה?״",
  submission: "השאלות האישיות בהגשה",
  review: "תשובה למייל ההשלמות",
  email: "מייל",
  manual: "נרשם ידנית",
};
export const AUDIENCE_LABELS: Record<FeedbackAudience, string> = { submitter: "מגישות", participant: "משתתפות", other: "אחרות" };
export const KIND_LABELS: Record<FeedbackKind, string> = { praise: "שבח", criticism: "ביקורת", suggestion: "הצעה", mixed: "מעורב", reflection: "השאלות האישיות", borderline: "גבולי" };
export const SOURCES = Object.keys(SOURCE_LABELS) as FeedbackSource[];
export const KINDS = Object.keys(KIND_LABELS) as FeedbackKind[];

type Row = {
  id: string;
  profile_id: string | null;
  team_key: string | null;
  display_name: string;
  audience: string;
  source: string;
  source_ref: string | null;
  source_url: string | null;
  kind: string;
  topic: string | null;
  body: string;
  written_at: string;
  hidden_at: string | null;
};
const COLS = "id, profile_id, team_key, display_name, audience, source, source_ref, source_url, kind, topic, body, written_at, hidden_at";

function noteOf(r: Row): FeedbackNote {
  return {
    id: r.id,
    profileId: r.profile_id,
    teamKey: r.team_key,
    displayName: r.display_name,
    audience: (r.audience as FeedbackAudience) ?? "other",
    source: (r.source as FeedbackSource) ?? "manual",
    sourceRef: r.source_ref,
    sourceUrl: r.source_url,
    kind: (r.kind as FeedbackKind) ?? "borderline",
    topic: r.topic,
    body: r.body,
    writtenAt: r.written_at,
    hiddenAt: r.hidden_at,
  };
}

const byDate = (a: FeedbackNote, b: FeedbackNote) => a.writtenAt.localeCompare(b.writtenAt);

/** Her notes, oldest first - the hidden ones left out (the member page, the submission's card). */
export async function loadFeedbackNotesFor(profileIds: string[]): Promise<Map<string, FeedbackNote[]>> {
  const out = new Map<string, FeedbackNote[]>();
  const ids = [...new Set(profileIds)].filter(Boolean);
  if (ids.length === 0) return out;
  const { data } = await createAdminClient().from("hackathon_feedback_notes").select(COLS).in("profile_id", ids).is("hidden_at", null);
  for (const r of (data ?? []) as Row[]) {
    if (!r.profile_id) continue;
    out.set(r.profile_id, [...(out.get(r.profile_id) ?? []), noteOf(r)]);
  }
  for (const list of out.values()) list.sort(byDate);
  return out;
}

/**
 * The notes of whole teams (the admin's submission cards): everything said by a member of the
 * team, plus rows pinned to the team key itself (a pair's joint answer).
 */
export async function loadFeedbackNotesByTeam(teamKeys: string[]): Promise<Map<string, FeedbackNote[]>> {
  const out = new Map<string, FeedbackNote[]>();
  const keys = [...new Set(teamKeys)].filter(Boolean);
  if (keys.length === 0) return out;
  const members = [...new Set(keys.flatMap((k) => k.split("+")))];
  const admin = createAdminClient();
  const [{ data: byMember }, { data: byTeam }] = await Promise.all([
    admin.from("hackathon_feedback_notes").select(COLS).in("profile_id", members).is("hidden_at", null),
    admin.from("hackathon_feedback_notes").select(COLS).in("team_key", keys).is("hidden_at", null),
  ]);
  const seen = new Set<string>();
  const all: FeedbackNote[] = [];
  for (const r of [...((byMember ?? []) as Row[]), ...((byTeam ?? []) as Row[])]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    all.push(noteOf(r));
  }
  for (const k of keys) {
    const ids = new Set(k.split("+"));
    const list = all.filter((n) => n.teamKey === k || (n.profileId && ids.has(n.profileId))).sort(byDate);
    if (list.length) out.set(k, list);
  }
  return out;
}

/** Every note, the hidden ones included, newest first - the admin's list and the PDF. */
export async function loadAllFeedbackNotes(): Promise<FeedbackNote[]> {
  const { data } = await createAdminClient().from("hackathon_feedback_notes").select(COLS).order("written_at", { ascending: false }).limit(2000);
  return ((data ?? []) as Row[]).map(noteOf);
}

export interface NewFeedbackNote {
  profileId: string | null;
  teamKey: string | null;
  displayName: string;
  audience: FeedbackAudience;
  source: FeedbackSource;
  sourceRef: string | null;
  sourceUrl: string | null;
  kind: FeedbackKind;
  topic: string | null;
  body: string;
  writtenAt: string;
}

export async function insertFeedbackNote(n: NewFeedbackNote, byId: string | null): Promise<void> {
  const { error } = await createAdminClient().from("hackathon_feedback_notes").insert({
    profile_id: n.profileId,
    team_key: n.teamKey,
    display_name: n.displayName,
    audience: n.audience,
    source: n.source,
    source_ref: n.sourceRef,
    source_url: n.sourceUrl,
    kind: n.kind,
    topic: n.topic,
    body: n.body,
    written_at: n.writtenAt,
    created_by: byId,
  });
  if (error) throw error;
}

export async function setFeedbackNoteHidden(id: string, hidden: boolean): Promise<void> {
  const { error } = await createAdminClient()
    .from("hackathon_feedback_notes")
    .update({ hidden_at: hidden ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Her place in the hackathon, for a note typed by hand: in a submitted team, registered only, or neither. */
export async function audienceOf(profileId: string | null): Promise<{ audience: FeedbackAudience; teamKey: string | null }> {
  if (!profileId) return { audience: "other", teamKey: null };
  const admin = createAdminClient();
  const [{ data: subs }, { data: own }, { data: asPartner }] = await Promise.all([
    admin.from("hackathon_submissions").select("team_key").not("submitted_at", "is", null).or(`team_key.eq.${profileId},team_key.like.${profileId}+%,team_key.like.%+${profileId}`),
    admin.from("hackathon_registrations").select("profile_id").eq("profile_id", profileId).maybeSingle(),
    admin.from("hackathon_registrations").select("profile_id").eq("partner_profile_id", profileId).not("partner_confirmed_at", "is", null).maybeSingle(),
  ]);
  const team = (subs ?? []).map((s) => s.team_key as string).find((k) => k.split("+").includes(profileId));
  if (team) return { audience: "submitter", teamKey: team };
  if (own || asPartner) return { audience: "participant", teamKey: null };
  return { audience: "other", teamKey: null };
}
