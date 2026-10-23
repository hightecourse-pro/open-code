import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { withPrevSurnames } from "@/lib/prev-surname";
import { loadAdminSubmissions, type AdminSubmissionRow } from "@/lib/hackathon-submission";
import { CRITERIA, GAP_THRESHOLD, ZERO_SCORES, totalOf, type AutoReport, type CriterionKey, type Scores } from "@/lib/judging-shared";

/**
 * Who may judge, and what she may see (the owner, 23/10): an appointed judge
 * (hackathon_judges - a mentor OR a team member) sees only the projects of her
 * challenges and only her own scores - never the automated report, never
 * another judge's score, not even in the admin. An admin who is NOT an
 * appointed judge (the owner) sees everything, side by side.
 */
export interface JudgeAccess {
  judge: boolean;
  /** Appointed judge: her challenges, her scores only. */
  restricted: boolean;
  /** Empty = every challenge. */
  challengeKeys: string[];
}

export async function judgeAccessFor(profile: { id: string; role: string; status: string }): Promise<JudgeAccess> {
  const { data } = await createAdminClient().from("hackathon_judges").select("challenge_keys").eq("profile_id", profile.id).maybeSingle();
  if (data) {
    const eligible = profile.role === "admin" || (profile.role === "mentor" && profile.status === "active");
    return { judge: eligible, restricted: true, challengeKeys: data.challenge_keys ?? [] };
  }
  if (profile.role === "admin") return { judge: true, restricted: false, challengeKeys: [] };
  return { judge: false, restricted: true, challengeKeys: [] };
}

/** The sidebar's gate. */
export async function isJudge(profile: { id: string; role: string; status: string }): Promise<boolean> {
  return (await judgeAccessFor(profile)).judge;
}

export interface JudgeRow {
  id: string;
  name: string;
  initials: string;
  role: string;
  challengeKeys: string[];
  scored: number;
}

export async function loadJudges(): Promise<JudgeRow[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin.from("hackathon_judges").select("profile_id, challenge_keys");
  const ids = (rows ?? []).map((r) => r.profile_id);
  if (ids.length === 0) return [];
  const keysOf = new Map((rows ?? []).map((r) => [r.profile_id, r.challenge_keys ?? []]));
  const [{ data: profs }, { data: scores }] = await Promise.all([
    admin.from("profiles").select("id, full_name, avatar_initials, role").in("id", ids),
    admin.from("hackathon_scores").select("judge_id").in("judge_id", ids),
  ]);
  const named = await withPrevSurnames(profs ?? []);
  const countOf = new Map<string, number>();
  for (const s of scores ?? []) countOf.set(s.judge_id, (countOf.get(s.judge_id) ?? 0) + 1);
  return named.map((p) => ({
    id: p.id,
    name: p.full_name,
    initials: p.avatar_initials || p.full_name.slice(0, 1),
    role: p.role,
    challengeKeys: keysOf.get(p.id) ?? [],
    scored: countOf.get(p.id) ?? 0,
  }));
}

export interface ScoreRow {
  judgeId: string;
  judgeName: string;
  scores: Scores;
  notes: Partial<Record<CriterionKey, string>>;
  comment: string | null;
  total: number;
  capped: boolean;
  updatedAt: string;
}

export interface JudgingEntry {
  submission: AdminSubmissionRow;
  /** The automated report - the owner's view only. */
  report: AutoReport | null;
  reportUpdatedAt: string | null;
  /** The viewer's own score (judge view) - or, for the owner, every judge's. */
  scores: ScoreRow[];
  mine: ScoreRow | null;
  average: number | null;
  gap: boolean;
  rank: number | null;
}

const emptyScores = (): Scores => ({ ...ZERO_SCORES });

/**
 * The board: every submitted project with its scores. An appointed judge gets
 * the projects of her challenges and her own score only (no anchoring on the
 * others, no automated report); the owner gets all of it - every score, the
 * average, the gap flag and the rank inside each challenge.
 */
export async function loadJudgingBoard(viewer: { id: string; role: string; status: string }): Promise<{ entries: JudgingEntry[]; judges: JudgeRow[]; access: JudgeAccess }> {
  const admin = createAdminClient();
  const access = await judgeAccessFor(viewer);
  const full = access.judge && !access.restricted;
  const [submissions, { data: reports }, { data: scoreRows }, judges] = await Promise.all([
    loadAdminSubmissions(),
    full ? admin.from("hackathon_auto_reports").select("team_key, report, updated_at") : Promise.resolve({ data: [] as { team_key: string; report: unknown; updated_at: string }[] }),
    full ? admin.from("hackathon_scores").select("*") : admin.from("hackathon_scores").select("*").eq("judge_id", viewer.id),
    full ? loadJudges() : Promise.resolve([] as JudgeRow[]),
  ]);
  const judgeName = new Map(judges.map((j) => [j.id, j.name]));
  if (full) {
    // Admins who scored are judges too, even when not in the appointed list.
    const missing = [...new Set((scoreRows ?? []).map((s) => s.judge_id))].filter((id) => !judgeName.has(id));
    if (missing.length) {
      const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", missing);
      for (const p of await withPrevSurnames(profs ?? [])) judgeName.set(p.id, p.full_name);
    }
  }
  const reportOf = new Map((reports ?? []).map((r) => [r.team_key, r]));
  const scoresOf = new Map<string, ScoreRow[]>();
  for (const s of scoreRows ?? []) {
    const scores: Scores = { works: s.works, correctness: s.correctness, problem: s.problem, architecture: s.architecture, ux: s.ux, original: s.original ?? 0 };
    const t = totalOf(scores);
    const row: ScoreRow = {
      judgeId: s.judge_id,
      judgeName: judgeName.get(s.judge_id) ?? (s.judge_id === viewer.id ? "את" : "שופטת"),
      scores,
      notes: (s.notes ?? {}) as Partial<Record<CriterionKey, string>>,
      comment: s.comment ?? null,
      total: t.total,
      capped: t.capped,
      updatedAt: s.updated_at,
    };
    scoresOf.set(s.team_key, [...(scoresOf.get(s.team_key) ?? []), row]);
  }
  // An appointed judge sees her challenges only; not assigned yet = nothing (the owner, 23/10).
  const scoped = access.restricted ? (access.challengeKeys.length > 0 ? submissions.filter((s) => access.challengeKeys.includes(s.challengeKey)) : []) : submissions;
  const entries: JudgingEntry[] = scoped
    .filter((s) => s.submittedAt)
    .sort((a, b) => a.challengeKey.localeCompare(b.challengeKey) || (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""))
    .map((submission) => {
      const scores = scoresOf.get(submission.teamKey) ?? [];
      const mine = scores.find((s) => s.judgeId === viewer.id) ?? null;
      const totals = scores.map((s) => s.total);
      const average = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null;
      const gap = totals.length >= 2 && Math.max(...totals) - Math.min(...totals) > GAP_THRESHOLD;
      const rep = reportOf.get(submission.teamKey);
      return { submission, report: (rep?.report as AutoReport | null) ?? null, reportUpdatedAt: rep?.updated_at ?? null, scores, mine, average, gap, rank: null };
    });
  // Rank inside each challenge, by average (the owner's view only has all the scores).
  if (full) {
    for (const key of new Set(entries.map((e) => e.submission.challengeKey))) {
      const group = entries.filter((e) => e.submission.challengeKey === key && e.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
      group.forEach((e, i) => (e.rank = i + 1));
    }
  }
  return { entries, judges, access };
}

export function blankScores(): Scores {
  return emptyScores();
}

export { CRITERIA };
