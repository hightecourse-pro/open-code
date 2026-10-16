import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { withPrevSurnames } from "@/lib/prev-surname";
import { loadAdminSubmissions, type AdminSubmissionRow } from "@/lib/hackathon-submission";
import { CRITERIA, GAP_THRESHOLD, totalOf, type AutoReport, type CriterionKey, type Scores } from "@/lib/judging-shared";

/** Admins always judge; a mentor judges once the team appointed her. */
export async function isJudge(profile: { id: string; role: string; status: string }): Promise<boolean> {
  if (profile.role === "admin") return true;
  if (profile.role !== "mentor" || profile.status !== "active") return false;
  const { data } = await createAdminClient().from("hackathon_judges").select("profile_id").eq("profile_id", profile.id).maybeSingle();
  return !!data;
}

export interface JudgeRow {
  id: string;
  name: string;
  initials: string;
  scored: number;
}

export async function loadJudges(): Promise<JudgeRow[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin.from("hackathon_judges").select("profile_id");
  const ids = (rows ?? []).map((r) => r.profile_id);
  if (ids.length === 0) return [];
  const [{ data: profs }, { data: scores }] = await Promise.all([
    admin.from("profiles").select("id, full_name, avatar_initials").in("id", ids),
    admin.from("hackathon_scores").select("judge_id").in("judge_id", ids),
  ]);
  const named = await withPrevSurnames(profs ?? []);
  const countOf = new Map<string, number>();
  for (const s of scores ?? []) countOf.set(s.judge_id, (countOf.get(s.judge_id) ?? 0) + 1);
  return named.map((p) => ({ id: p.id, name: p.full_name, initials: p.avatar_initials || p.full_name.slice(0, 1), scored: countOf.get(p.id) ?? 0 }));
}

export interface ScoreRow {
  judgeId: string;
  judgeName: string;
  scores: Scores;
  notes: Partial<Record<CriterionKey, string>>;
  total: number;
  capped: boolean;
  updatedAt: string;
}

export interface JudgingEntry {
  submission: AdminSubmissionRow;
  report: AutoReport | null;
  reportUpdatedAt: string | null;
  /** The viewer's own score (judge view) - or, for the team, every judge's. */
  scores: ScoreRow[];
  mine: ScoreRow | null;
  average: number | null;
  gap: boolean;
  rank: number | null;
}

const emptyScores = (): Scores => ({ works: 0, correctness: 0, problem: 0, architecture: 0, ux: 0, presentation: 0 });

/**
 * The board: every submission with its automated report and scores. A judge
 * sees only her own scores (no anchoring on the others); the team sees all,
 * the average, the gap flag and the rank inside each challenge.
 */
export async function loadJudgingBoard(viewer: { id: string; role: string }): Promise<{ entries: JudgingEntry[]; judges: JudgeRow[] }> {
  const admin = createAdminClient();
  const isAdmin = viewer.role === "admin";
  const [submissions, { data: reports }, { data: scoreRows }, judges] = await Promise.all([
    loadAdminSubmissions(),
    admin.from("hackathon_auto_reports").select("team_key, report, updated_at"),
    isAdmin
      ? admin.from("hackathon_scores").select("*")
      : admin.from("hackathon_scores").select("*").eq("judge_id", viewer.id),
    isAdmin ? loadJudges() : Promise.resolve([] as JudgeRow[]),
  ]);
  const judgeName = new Map(judges.map((j) => [j.id, j.name]));
  if (isAdmin) {
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
    const scores: Scores = { works: s.works, correctness: s.correctness, problem: s.problem, architecture: s.architecture, ux: s.ux, presentation: s.presentation };
    const t = totalOf(scores);
    const row: ScoreRow = {
      judgeId: s.judge_id,
      judgeName: judgeName.get(s.judge_id) ?? (s.judge_id === viewer.id ? "את" : "שופטת"),
      scores,
      notes: (s.notes ?? {}) as Partial<Record<CriterionKey, string>>,
      total: t.total,
      capped: t.capped,
      updatedAt: s.updated_at,
    };
    scoresOf.set(s.team_key, [...(scoresOf.get(s.team_key) ?? []), row]);
  }
  const entries: JudgingEntry[] = submissions
    .filter((s) => s.submittedAt)
    .map((submission) => {
      const scores = scoresOf.get(submission.teamKey) ?? [];
      const mine = scores.find((s) => s.judgeId === viewer.id) ?? null;
      const totals = scores.map((s) => s.total);
      const average = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null;
      const gap = totals.length >= 2 && Math.max(...totals) - Math.min(...totals) > GAP_THRESHOLD;
      const rep = reportOf.get(submission.teamKey);
      return { submission, report: (rep?.report as AutoReport | null) ?? null, reportUpdatedAt: rep?.updated_at ?? null, scores, mine, average, gap, rank: null };
    });
  // Rank inside each challenge, by average (the team's view only has all the scores).
  if (isAdmin) {
    for (const key of new Set(entries.map((e) => e.submission.challengeKey))) {
      const group = entries.filter((e) => e.submission.challengeKey === key && e.average !== null).sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
      group.forEach((e, i) => (e.rank = i + 1));
    }
  }
  return { entries, judges };
}

export function blankScores(): Scores {
  return emptyScores();
}

export { CRITERIA };
