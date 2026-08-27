// The mentor score, computed straight from its sources every time — a ledger
// would be a second copy of the same facts that could drift. Public rule:
// answering in the forum earns points, being matched to a junior earns more.

import { createAdminClient } from "@/lib/supabase/admin";

export const ANSWER_POINTS = 5;
export const ASSIGNMENT_POINTS = 25;

export interface MentorScore {
  answers: number;
  assignments: number;
  /** Hand-awarded points (mentor_bonus_points ledger) — admin-granted. */
  bonus: number;
  score: number;
}

/**
 * Scores for a set of mentors. "Answers" are comments she wrote on posts that
 * are NOT her own — replying to yourself is not mentoring.
 */
export async function mentorScores(ids: string[]): Promise<Map<string, MentorScore>> {
  const out = new Map<string, MentorScore>();
  if (ids.length === 0) return out;
  for (const id of ids) out.set(id, { answers: 0, assignments: 0, bonus: 0, score: 0 });

  const admin = createAdminClient();
  const [{ data: comments }, { data: assignments }, { data: bonuses }] = await Promise.all([
    admin
      .from("comments")
      .select("author_id, posts!inner(author_id)")
      .in("author_id", ids),
    admin
      .from("mentor_requests")
      .select("assigned_mentor_id")
      .in("assigned_mentor_id", ids)
      // An assignment counts once the mentor ACCEPTED it.
      .not("mentor_accepted_at", "is", null),
    admin.from("mentor_bonus_points").select("mentor_id, points").in("mentor_id", ids),
  ]);

  for (const c of (comments ?? []) as unknown as { author_id: string; posts: { author_id: string } }[]) {
    if (c.posts?.author_id === c.author_id) continue;
    const s = out.get(c.author_id);
    if (s) s.answers++;
  }
  for (const a of assignments ?? []) {
    const s = a.assigned_mentor_id ? out.get(a.assigned_mentor_id) : undefined;
    if (s) s.assignments++;
  }
  for (const b of bonuses ?? []) {
    const s = out.get(b.mentor_id);
    if (s) s.bonus += b.points;
  }
  for (const s of out.values()) {
    s.score = s.answers * ANSWER_POINTS + s.assignments * ASSIGNMENT_POINTS + s.bonus;
  }
  return out;
}
