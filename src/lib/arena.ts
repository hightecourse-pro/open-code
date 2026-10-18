import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { inChunks } from "@/lib/chunk";
import { loadHackathonRegistrantIds } from "@/lib/hackathon";
import { CHALLENGES } from "@/app/hackathon-2026/shared";
import { mentorScores } from "@/lib/mentor-score";
import { ARENA_AI_VALUES, ARENA_ANSWER_POINTS, ARENA_HELPFUL_POINTS, NUDGE_AFTER_HOURS, type ArenaRole, type ArenaStatus } from "@/lib/arena-shared";

/**
 * זירת המנטוריות (the owner, 15/10): "כל מי שמגישה להאקתון יכולה להיכנס
 * לזירה ויכולה לשלוח שאלות; כל מנטורית רואה את השאלות של כולן". Who may
 * enter: a hackathon registrant (own registration or a confirmed partner),
 * an active mentor, the team.
 */
export async function arenaRoleFor(profile: { id: string; role: string; status: string }): Promise<ArenaRole | null> {
  if (profile.role === "admin") return "admin";
  if (profile.role === "mentor") return profile.status === "active" ? "mentor" : null;
  if (profile.status === "rejected") return null;
  const regs = await loadHackathonRegistrantIds([profile.id]);
  return regs.has(profile.id) ? "participant" : null;
}

export interface ArenaMentor {
  id: string;
  name: string;
  initials: string;
  specialization: string | null;
  /** Answered "mentor_ai_experience" with real AI experience. */
  ai: boolean;
  available: boolean;
  /** "אני כאן עכשיו" - marked herself present for the next hour. */
  present: boolean;
  presentUntil: string | null;
  /** Her strongest techs (labels), for the mentor cards. */
  techs: string[];
}

/** Active mentors, with the AI flag, techs and presence. */
export async function loadArenaMentors(): Promise<ArenaMentor[]> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const [{ data: mentors }, { data: qs }, { data: presence }, { data: techTax }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization, mentor_available")
      .eq("role", "mentor")
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    admin.from("config_questions").select("id, key").in("key", ["mentor_ai_experience", "mentor_tech"]),
    admin.from("arena_presence").select("profile_id, until").gt("until", now),
    admin.from("config_taxonomies").select("value, label_he").eq("kind", "tech"),
  ]);
  const aiQ = (qs ?? []).find((q) => q.key === "mentor_ai_experience")?.id;
  const techQ = (qs ?? []).find((q) => q.key === "mentor_tech")?.id;
  const techLabel = new Map((techTax ?? []).map((t) => [t.value, t.label_he]));
  const aiOf = new Map<string, boolean>();
  const techsOf = new Map<string, string[]>();
  if (mentors?.length && (aiQ || techQ)) {
    const ans = await inChunks<{ profile_id: string; question_id: string; value: unknown }>(
      mentors.map((m) => m.id),
      (part) =>
        admin
          .from("profile_answers")
          .select("profile_id, question_id, value")
          .in("question_id", [aiQ, techQ].filter((x): x is string => !!x))
          .in("profile_id", part)
    );
    for (const a of ans) {
      if (a.question_id === aiQ) aiOf.set(a.profile_id, typeof a.value === "string" && ARENA_AI_VALUES.includes(a.value));
      if (a.question_id === techQ && Array.isArray(a.value)) {
        techsOf.set(
          a.profile_id,
          a.value.filter((v): v is string => typeof v === "string").map((v) => techLabel.get(v) ?? v).slice(0, 6)
        );
      }
    }
  }
  const untilOf = new Map((presence ?? []).map((p) => [p.profile_id, p.until]));
  return (mentors ?? []).map((m) => ({
    id: m.id,
    name: m.full_name,
    initials: m.avatar_initials || m.full_name.slice(0, 1) || "מ",
    specialization: m.specialization,
    ai: aiOf.get(m.id) ?? false,
    available: m.mentor_available !== false,
    present: untilOf.has(m.id),
    presentUntil: untilOf.get(m.id) ?? null,
    techs: techsOf.get(m.id) ?? [],
  }));
}

export interface ArenaAnswer {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  /** "mentor" - an answer; "asker" - a follow-up by the woman who asked. */
  authorRole: "mentor" | "asker";
  body: string;
  helpfulAt: string | null;
  createdAt: string;
}

export interface ArenaQuestion {
  id: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  title: string;
  body: string;
  targetMentorId: string | null;
  targetMentorName: string | null;
  aiOnly: boolean;
  isPrivate: boolean;
  topic: string | null;
  status: ArenaStatus;
  createdAt: string;
  pinnedAt: string | null;
  nudgedAt: string | null;
  /** Open for more than NUDGE_AFTER_HOURS. */
  stale: boolean;
  answers: ArenaAnswer[];
  /** The hackathon challenge the asker is registered to (own or as a partner). */
  challengeKey: string | null;
  challengeShort: string | null;
  challengeEmoji: string | null;
}

/** profile id → challenge key, for registrants and confirmed partners. */
async function challengesOf(profileIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (profileIds.length === 0) return out;
  const admin = createAdminClient();
  const [own, partner] = await Promise.all([
    inChunks<{ profile_id: string; challenge_key: string }>(profileIds, (part) =>
      admin.from("hackathon_registrations").select("profile_id, challenge_key").in("profile_id", part)
    ),
    inChunks<{ partner_profile_id: string | null; challenge_key: string }>(profileIds, (part) =>
      admin.from("hackathon_registrations").select("partner_profile_id, challenge_key").in("partner_profile_id", part).not("partner_confirmed_at", "is", null)
    ),
  ]);
  for (const r of partner) if (r.partner_profile_id) out.set(r.partner_profile_id, r.challenge_key);
  for (const r of own) out.set(r.profile_id, r.challenge_key);
  return out;
}

/**
 * The board: newest first, with authors, targets and the whole thread. A
 * private question reaches mentors, the team, and the woman who asked it.
 */
export async function loadArenaQuestions(viewer: { id: string; role: ArenaRole }, limit = 200): Promise<ArenaQuestion[]> {
  const admin = createAdminClient();
  let query = admin
    .from("arena_questions")
    .select("id, author_id, title, body, target_mentor_id, ai_only, is_private, topic, status, created_at, pinned_at, nudged_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (viewer.role === "participant") query = query.or(`is_private.eq.false,author_id.eq.${viewer.id}`);
  const { data: qs } = await query;
  if (!qs?.length) return [];
  const answers = await inChunks<{ id: string; question_id: string; mentor_id: string; author_role: string; body: string; helpful_at: string | null; created_at: string }>(
    qs.map((q) => q.id),
    (part) => admin.from("arena_answers").select("id, question_id, mentor_id, author_role, body, helpful_at, created_at").in("question_id", part).order("created_at", { ascending: true })
  );
  const ids = [
    ...new Set([
      ...qs.map((q) => q.author_id),
      ...qs.map((q) => q.target_mentor_id).filter((x): x is string => !!x),
      ...answers.map((a) => a.mentor_id),
    ]),
  ];
  const [profs, challengeOf] = await Promise.all([
    inChunks<{ id: string; full_name: string; avatar_initials: string | null }>(ids, (part) =>
      admin.from("profiles").select("id, full_name, avatar_initials").in("id", part)
    ),
    challengesOf([...new Set(qs.map((q) => q.author_id))]),
  ]);
  const pOf = new Map(profs.map((p) => [p.id, p]));
  const challenge = (authorId: string) => {
    const key = challengeOf.get(authorId) ?? null;
    const c = key ? CHALLENGES.find((x) => x.key === key) : null;
    return { challengeKey: key, challengeShort: c?.short ?? null, challengeEmoji: c?.emoji ?? null };
  };
  const nameOf = (id: string) => pOf.get(id)?.full_name || "חברת קהילה";
  const initialsOf = (id: string) => pOf.get(id)?.avatar_initials || nameOf(id).slice(0, 1);
  const staleEdge = Date.now() - NUDGE_AFTER_HOURS * 3600 * 1000;
  return qs.map((q) => ({
    id: q.id,
    authorId: q.author_id,
    authorName: nameOf(q.author_id),
    authorInitials: initialsOf(q.author_id),
    title: q.title,
    body: q.body,
    targetMentorId: q.target_mentor_id,
    targetMentorName: q.target_mentor_id ? nameOf(q.target_mentor_id) : null,
    aiOnly: q.ai_only === true,
    isPrivate: q.is_private === true,
    topic: q.topic,
    status: q.status as ArenaStatus,
    createdAt: q.created_at,
    pinnedAt: q.pinned_at,
    nudgedAt: q.nudged_at,
    stale: q.status === "open" && new Date(q.created_at).getTime() < staleEdge,
    ...challenge(q.author_id),
    answers: answers
      .filter((a) => a.question_id === q.id)
      .map((a) => ({
        id: a.id,
        authorId: a.mentor_id,
        authorName: nameOf(a.mentor_id),
        authorInitials: initialsOf(a.mentor_id),
        authorRole: a.author_role === "asker" ? "asker" : "mentor",
        body: a.body,
        helpfulAt: a.helpful_at,
        createdAt: a.created_at,
      })),
  }));
}

export async function countOpenArenaQuestions(): Promise<number> {
  const { count } = await createAdminClient().from("arena_questions").select("id", { count: "exact", head: true }).eq("status", "open");
  return count ?? 0;
}

export interface ArenaMentorStats {
  arenaAnswers: number;
  helpful: number;
  arenaPoints: number;
  totalScore: number;
}

/** Her arena tally and her whole mentor score - the numbers on the hero card. */
export async function mentorArenaStats(mentorId: string): Promise<ArenaMentorStats> {
  const s = (await mentorScores([mentorId])).get(mentorId);
  const arena = s?.arena ?? 0;
  const helpful = s?.helpful ?? 0;
  return { arenaAnswers: arena, helpful, arenaPoints: arena * ARENA_ANSWER_POINTS + helpful * ARENA_HELPFUL_POINTS, totalScore: s?.score ?? 0 };
}

export interface ArenaLeader {
  id: string;
  name: string;
  initials: string;
  answers: number;
  helpful: number;
  points: number;
}

/** Top mentors by arena points - the "המובילות בזירה" strip and the weekly mail. */
export async function arenaLeaderboard(limit = 5): Promise<ArenaLeader[]> {
  const mentors = await loadArenaMentors();
  if (mentors.length === 0) return [];
  const { data } = await createAdminClient().rpc("mentor_arena_counts", { p_ids: mentors.map((m) => m.id) });
  const mOf = new Map(mentors.map((m) => [m.id, m]));
  return ((data ?? []) as { mentor_id: string; answers: number; helpful: number }[])
    .map((r) => {
      const m = mOf.get(r.mentor_id);
      if (!m) return null;
      const answers = Number(r.answers);
      const helpful = Number(r.helpful ?? 0);
      return { id: m.id, name: m.name, initials: m.initials, answers, helpful, points: answers * ARENA_ANSWER_POINTS + helpful * ARENA_HELPFUL_POINTS };
    })
    .filter((x): x is ArenaLeader => !!x)
    .sort((a, b) => b.points - a.points || b.answers - a.answers)
    .slice(0, limit);
}

export interface ArenaOverview {
  open: number;
  stale: number;
  answered: number;
  closed: number;
  /** Median hours from a question to its first mentor answer, over answered questions. */
  medianResponseHours: number | null;
  presentNow: number;
  mentorsTotal: number;
  neverAnswered: { id: string; name: string }[];
  helpfulTotal: number;
}

/** The team's view of how the arena is doing (admin section). */
export async function arenaOverview(): Promise<ArenaOverview> {
  const admin = createAdminClient();
  const [{ data: qs }, { data: firsts }, mentors, { data: helpfulRows }] = await Promise.all([
    admin.from("arena_questions").select("id, status, created_at").limit(5000),
    admin.from("arena_answers").select("question_id, mentor_id, created_at").eq("author_role", "mentor").order("created_at", { ascending: true }).limit(20000),
    loadArenaMentors(),
    admin.from("arena_answers").select("id", { count: "exact", head: true }).not("helpful_at", "is", null),
  ]);
  const staleEdge = Date.now() - NUDGE_AFTER_HOURS * 3600 * 1000;
  const createdOf = new Map((qs ?? []).map((q) => [q.id, new Date(q.created_at).getTime()]));
  const firstOf = new Map<string, number>();
  const answeredBy = new Set<string>();
  for (const a of firsts ?? []) {
    answeredBy.add(a.mentor_id);
    if (!firstOf.has(a.question_id)) firstOf.set(a.question_id, new Date(a.created_at).getTime());
  }
  const hours = [...firstOf.entries()].map(([qid, t]) => (t - (createdOf.get(qid) ?? t)) / 3600000).filter((h) => h >= 0).sort((a, b) => a - b);
  const median = hours.length ? Math.round(hours[Math.floor(hours.length / 2)] * 10) / 10 : null;
  void helpfulRows;
  const { count: helpfulCount } = await admin.from("arena_answers").select("id", { count: "exact", head: true }).not("helpful_at", "is", null);
  return {
    open: (qs ?? []).filter((q) => q.status === "open").length,
    stale: (qs ?? []).filter((q) => q.status === "open" && new Date(q.created_at).getTime() < staleEdge).length,
    answered: (qs ?? []).filter((q) => q.status === "answered").length,
    closed: (qs ?? []).filter((q) => q.status === "closed").length,
    medianResponseHours: median,
    presentNow: mentors.filter((m) => m.present).length,
    mentorsTotal: mentors.length,
    neverAnswered: mentors.filter((m) => !answeredBy.has(m.id)).map((m) => ({ id: m.id, name: m.name })),
    helpfulTotal: helpfulCount ?? 0,
  };
}
