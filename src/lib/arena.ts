import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { inChunks } from "@/lib/chunk";
import { loadHackathonRegistrantIds } from "@/lib/hackathon";
import { mentorScores } from "@/lib/mentor-score";
import { ARENA_AI_VALUES, ARENA_ANSWER_POINTS, type ArenaRole, type ArenaStatus } from "@/lib/arena-shared";

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
}

/** Active mentors, with the AI flag from the questionnaire. */
export async function loadArenaMentors(): Promise<ArenaMentor[]> {
  const admin = createAdminClient();
  const [{ data: mentors }, { data: q }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization, mentor_available")
      .eq("role", "mentor")
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    admin.from("config_questions").select("id").eq("key", "mentor_ai_experience").maybeSingle(),
  ]);
  const aiOf = new Map<string, boolean>();
  if (q && mentors?.length) {
    const ans = await inChunks<{ profile_id: string; value: unknown }>(
      mentors.map((m) => m.id),
      (part) => admin.from("profile_answers").select("profile_id, value").eq("question_id", q.id).in("profile_id", part)
    );
    for (const a of ans) aiOf.set(a.profile_id, typeof a.value === "string" && ARENA_AI_VALUES.includes(a.value));
  }
  return (mentors ?? []).map((m) => ({
    id: m.id,
    name: m.full_name,
    initials: m.avatar_initials || m.full_name.slice(0, 1) || "מ",
    specialization: m.specialization,
    ai: aiOf.get(m.id) ?? false,
    available: m.mentor_available !== false,
  }));
}

/** A random available mentor; with aiOnly, one who knows AI (falls back to any AI mentor, then null). */
export function pickRandomMentor(mentors: ArenaMentor[], aiOnly: boolean): ArenaMentor | null {
  const available = mentors.filter((m) => m.available && (!aiOnly || m.ai));
  const pool = available.length > 0 ? available : aiOnly ? mentors.filter((m) => m.ai) : mentors;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export interface ArenaAnswer {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorInitials: string;
  body: string;
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
  status: ArenaStatus;
  createdAt: string;
  answers: ArenaAnswer[];
}

/** The board: newest first, with authors, targets and answers resolved. */
export async function loadArenaQuestions(limit = 200): Promise<ArenaQuestion[]> {
  const admin = createAdminClient();
  const { data: qs } = await admin
    .from("arena_questions")
    .select("id, author_id, title, body, target_mentor_id, ai_only, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!qs?.length) return [];
  const answers = await inChunks<{ id: string; question_id: string; mentor_id: string; body: string; created_at: string }>(
    qs.map((q) => q.id),
    (part) => admin.from("arena_answers").select("id, question_id, mentor_id, body, created_at").in("question_id", part).order("created_at", { ascending: true })
  );
  const ids = [
    ...new Set([
      ...qs.map((q) => q.author_id),
      ...qs.map((q) => q.target_mentor_id).filter((x): x is string => !!x),
      ...answers.map((a) => a.mentor_id),
    ]),
  ];
  const profs = await inChunks<{ id: string; full_name: string; avatar_initials: string | null }>(ids, (part) =>
    admin.from("profiles").select("id, full_name, avatar_initials").in("id", part)
  );
  const pOf = new Map(profs.map((p) => [p.id, p]));
  const nameOf = (id: string) => pOf.get(id)?.full_name || "חברת קהילה";
  const initialsOf = (id: string) => pOf.get(id)?.avatar_initials || nameOf(id).slice(0, 1);
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
    status: q.status as ArenaStatus,
    createdAt: q.created_at,
    answers: answers
      .filter((a) => a.question_id === q.id)
      .map((a) => ({ id: a.id, mentorId: a.mentor_id, mentorName: nameOf(a.mentor_id), mentorInitials: initialsOf(a.mentor_id), body: a.body, createdAt: a.created_at })),
  }));
}

export async function countOpenArenaQuestions(): Promise<number> {
  const { count } = await createAdminClient().from("arena_questions").select("id", { count: "exact", head: true }).eq("status", "open");
  return count ?? 0;
}

export interface ArenaMentorStats {
  arenaAnswers: number;
  arenaPoints: number;
  totalScore: number;
}

/** Her arena tally and her whole mentor score - the number she sees on the hero card. */
export async function mentorArenaStats(mentorId: string): Promise<ArenaMentorStats> {
  const s = (await mentorScores([mentorId])).get(mentorId);
  const arena = s?.arena ?? 0;
  return { arenaAnswers: arena, arenaPoints: arena * ARENA_ANSWER_POINTS, totalScore: s?.score ?? 0 };
}

export interface ArenaLeader {
  id: string;
  name: string;
  initials: string;
  answers: number;
  points: number;
}

/** Top mentors by arena answers - the "המובילות בזירה" strip. */
export async function arenaLeaderboard(limit = 5): Promise<ArenaLeader[]> {
  const mentors = await loadArenaMentors();
  if (mentors.length === 0) return [];
  const { data } = await createAdminClient().rpc("mentor_arena_counts", { p_ids: mentors.map((m) => m.id) });
  const mOf = new Map(mentors.map((m) => [m.id, m]));
  return ((data ?? []) as { mentor_id: string; answers: number }[])
    .map((r) => {
      const m = mOf.get(r.mentor_id);
      return m ? { id: m.id, name: m.name, initials: m.initials, answers: Number(r.answers), points: Number(r.answers) * ARENA_ANSWER_POINTS } : null;
    })
    .filter((x): x is ArenaLeader => !!x)
    .sort((a, b) => b.answers - a.answers)
    .slice(0, limit);
}
