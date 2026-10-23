import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHALLENGES, type Challenge } from "@/app/hackathon-2026/shared";
import { withPrevSurnames } from "@/lib/prev-surname";
import { htmlToPlainText } from "@/lib/rich-text";
import { netfreeSafeUrl } from "@/lib/netfree";
import { driveEmbedUrl } from "@/lib/drive";
import type { Json } from "@/types/database";

/**
 * הגשת התוצרים (the owner, 16/10): "בזוג - רק אחת מעלה הכל, אבל השאלות
 * הפרטיות נפרדות". The team is the unit of the shared submission; the
 * personal reflections are one row per woman.
 */
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // the bucket's own limit
export const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "m4v"];

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
}
export interface Team {
  teamKey: string;
  challengeKey: string;
  challenge: Challenge | null;
  members: TeamMember[];
  isPair: boolean;
}

/** The team key of a registration row: solo = her id; a confirmed pair = both ids, sorted. */
export function teamKeyOf(profileId: string, partnerId: string | null, partnerConfirmed: boolean): string {
  return partnerId && partnerConfirmed ? [profileId, partnerId].sort().join("+") : profileId;
}

/** Her team - from her own registration, or from the pair row that names her as a confirmed partner. */
export async function loadTeam(profileId: string): Promise<Team | null> {
  const admin = createAdminClient();
  const [{ data: own }, { data: asPartner }] = await Promise.all([
    admin
      .from("hackathon_registrations")
      .select("profile_id, challenge_key, partner_profile_id, partner_confirmed_at")
      .eq("profile_id", profileId)
      .maybeSingle(),
    admin
      .from("hackathon_registrations")
      .select("profile_id, challenge_key, partner_profile_id, partner_confirmed_at")
      .eq("partner_profile_id", profileId)
      .not("partner_confirmed_at", "is", null)
      .maybeSingle(),
  ]);
  let ids: string[];
  let challengeKey: string;
  if (own) {
    const confirmed = !!own.partner_profile_id && !!own.partner_confirmed_at;
    ids = confirmed ? [own.profile_id, own.partner_profile_id as string] : [own.profile_id];
    challengeKey = own.challenge_key;
  } else if (asPartner) {
    ids = [asPartner.profile_id, profileId];
    challengeKey = asPartner.challenge_key;
  } else {
    return null;
  }
  const { data: profs } = await admin.from("profiles").select("id, full_name, avatar_initials").in("id", ids);
  const named = await withPrevSurnames(profs ?? []);
  // She first, then her partner.
  const members = ids
    .map((id) => named.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ id: p.id, name: p.full_name, initials: p.avatar_initials || p.full_name.slice(0, 1) }))
    .sort((a, b) => (a.id === profileId ? -1 : b.id === profileId ? 1 : 0));
  return {
    teamKey: ids.length === 2 ? [...ids].sort().join("+") : ids[0],
    challengeKey,
    challenge: CHALLENGES.find((c) => c.key === challengeKey) ?? null,
    members,
    isPair: ids.length === 2,
  };
}

export interface Submission {
  id: string;
  teamKey: string;
  challengeKey: string;
  productUrl: string | null;
  repoUrl: string | null;
  architecture: string | null;
  challengesSolved: string | null;
  /** The ninth part (20/10): what they built that the organisation did not ask for. */
  originalFeature: string | null;
  videoUrl: string | null;
  videoPath: string | null;
  videoSize: number | null;
  aiDevTools: string | null;
  aiModels: string | null;
  createdBy: string | null;
  submittedAt: string | null;
  updatedAt: string;
}

function toSubmission(r: {
  id: string;
  team_key: string;
  challenge_key: string;
  product_url: string | null;
  repo_url: string | null;
  architecture: string | null;
  challenges_solved: string | null;
  original_feature?: string | null;
  video_url: string | null;
  video_path: string | null;
  video_size: number | null;
  ai_dev_tools: string | null;
  ai_models: string | null;
  created_by: string | null;
  submitted_at: string | null;
  updated_at: string;
}): Submission {
  return {
    id: r.id,
    teamKey: r.team_key,
    challengeKey: r.challenge_key,
    productUrl: r.product_url,
    repoUrl: r.repo_url,
    architecture: r.architecture,
    challengesSolved: r.challenges_solved,
    originalFeature: r.original_feature ?? null,
    videoUrl: r.video_url,
    videoPath: r.video_path,
    videoSize: r.video_size,
    aiDevTools: r.ai_dev_tools,
    aiModels: r.ai_models,
    createdBy: r.created_by,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at,
  };
}

export async function loadSubmission(teamKey: string): Promise<Submission | null> {
  const { data } = await createAdminClient().from("hackathon_submissions").select("*").eq("team_key", teamKey).maybeSingle();
  return data ? toSubmission(data) : null;
}

export interface Reflection {
  contributed: string | null;
  learned: string | null;
  enjoyed: string | null;
  updatedAt: string;
}

export async function loadReflections(profileIds: string[]): Promise<Map<string, Reflection>> {
  const out = new Map<string, Reflection>();
  if (profileIds.length === 0) return out;
  const { data } = await createAdminClient()
    .from("hackathon_reflections")
    .select("profile_id, contributed, learned, enjoyed, updated_at")
    .in("profile_id", profileIds);
  for (const r of data ?? []) out.set(r.profile_id, { contributed: r.contributed, learned: r.learned, enjoyed: r.enjoyed, updatedAt: r.updated_at });
  return out;
}

/*
  סגירת ההגשות (the owner, 20/10): the teams may edit as long as the team has
  not pressed "סגירת ההגשות" in the admin. One app_settings row; the server
  actions refuse writes while closed and the submit page turns read-only.
*/
const CLOSURE_KEY = "hackathon_submissions";

export interface SubmissionsClosure {
  closedAt: string | null;
  closedBy: string | null;
}

export async function getSubmissionsClosure(): Promise<SubmissionsClosure> {
  try {
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", CLOSURE_KEY).maybeSingle();
    const v = (data?.value ?? {}) as { closed_at?: unknown; closed_by?: unknown };
    return { closedAt: typeof v.closed_at === "string" && v.closed_at ? v.closed_at : null, closedBy: typeof v.closed_by === "string" ? v.closed_by : null };
  } catch {
    return { closedAt: null, closedBy: null };
  }
}

export async function setSubmissionsClosure(closed: boolean, byId: string): Promise<void> {
  const value = closed ? { closed_at: new Date().toISOString(), closed_by: byId } : { closed_at: null, closed_by: byId };
  const { error } = await createAdminClient()
    .from("app_settings")
    .upsert({ key: CLOSURE_KEY, value: value as unknown as Json }, { onConflict: "key" });
  if (error) throw error;
}

/** The six parts of the owner's published list (20/10): link, repo, architecture, video, original feature, the personal questions. */
export interface SubmissionChecklist {
  product: boolean;
  repo: boolean;
  architecture: boolean;
  video: boolean;
  original: boolean;
  /** Her own reflections - all three answered. */
  reflection: boolean;
  done: number;
  total: number;
}

/** Rich HTML counts only when there is real text inside it. */
const has = (v: string | null | undefined) => !!v && htmlToPlainText(v).trim().length > 0;

/** What is ready, what is missing - the progress ring and the final gate share it. */
export function checklistOf(sub: Submission | null, mine: Reflection | null): SubmissionChecklist {
  const c = {
    product: has(sub?.productUrl),
    repo: has(sub?.repoUrl),
    architecture: has(sub?.architecture),
    video: has(sub?.videoUrl) || has(sub?.videoPath),
    original: has(sub?.originalFeature),
    reflection: has(mine?.contributed) && has(mine?.learned) && has(mine?.enjoyed),
  };
  const values = Object.values(c);
  return { ...c, done: values.filter(Boolean).length, total: values.length };
}

export interface AdminSubmissionRow {
  teamKey: string;
  challengeKey: string;
  challengeShort: string;
  members: { id: string; name: string; reflected: boolean; reflection: Reflection | null }[];
  productUrl: string | null;
  repoUrl: string | null;
  architecture: string | null;
  challengesSolved: string | null;
  originalFeature: string | null;
  videoUrl: string | null;
  /** The uploaded file, streamed through our domain (Netfree) - as a download and inline for the <video> tag. */
  videoDownloadUrl: string | null;
  videoInlineUrl: string | null;
  /** An embeddable player: the Drive mirror, a Drive link the team pasted, or YouTube. */
  videoEmbedUrl: string | null;
  driveFileId: string | null;
  videoSize: number | null;
  aiDevTools: string | null;
  aiModels: string | null;
  submittedAt: string | null;
  updatedAt: string;
}

/** A player URL for the judging desk: the Drive mirror first, then a pasted Drive or YouTube link. */
function embedUrlOf(driveFileId: string | null, url: string | null): string | null {
  if (driveFileId) return `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/preview`;
  if (!url) return null;
  const drive = driveEmbedUrl(url);
  if (drive) return drive;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/))([A-Za-z0-9_-]{6,})/);
  return yt ? `https://www.youtube.com/embed/${yt[1]}` : null;
}

/** Every team's submission for the admin, with a one-hour download link for uploaded videos. */
export async function loadAdminSubmissions(): Promise<AdminSubmissionRow[]> {
  const admin = createAdminClient();
  const { data: subs } = await admin.from("hackathon_submissions").select("*").order("submitted_at", { ascending: false, nullsFirst: false }).limit(1000);
  if (!subs?.length) return [];
  const ids = [...new Set(subs.flatMap((s) => s.team_key.split("+")))];
  const [{ data: profs }, reflections] = await Promise.all([admin.from("profiles").select("id, full_name, avatar_initials").in("id", ids), loadReflections(ids)]);
  const named = await withPrevSurnames(profs ?? []);
  const nameOf = new Map(named.map((p) => [p.id, p.full_name]));
  const paths = subs.map((s) => s.video_path).filter((p): p is string => !!p);
  const { data: signed } = paths.length ? await admin.storage.from("hackathon").createSignedUrls(paths, 3600) : { data: [] };
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return subs.map((s) => ({
    teamKey: s.team_key,
    challengeKey: s.challenge_key,
    challengeShort: CHALLENGES.find((c) => c.key === s.challenge_key)?.short ?? s.challenge_key,
    members: s.team_key.split("+").map((id) => {
      const r = reflections.get(id);
      return { id, name: nameOf.get(id) ?? "חברת קהילה", reflected: !!r && has(r.contributed) && has(r.learned) && has(r.enjoyed), reflection: r ?? null };
    }),
    productUrl: s.product_url,
    repoUrl: s.repo_url,
    architecture: s.architecture,
    challengesSolved: s.challenges_solved,
    originalFeature: s.original_feature ?? null,
    videoUrl: s.video_url,
    videoDownloadUrl: s.video_path ? netfreeSafeUrl(urlOf.get(s.video_path) ?? null, { download: s.video_path.split("/").pop() ?? "video.mp4" }) : null,
    videoInlineUrl: s.video_path ? netfreeSafeUrl(urlOf.get(s.video_path) ?? null) : null,
    videoEmbedUrl: embedUrlOf(s.drive_file_id ?? null, s.video_url),
    driveFileId: s.drive_file_id ?? null,
    videoSize: s.video_size,
    aiDevTools: s.ai_dev_tools,
    aiModels: s.ai_models,
    submittedAt: s.submitted_at,
    updatedAt: s.updated_at,
  }));
}
