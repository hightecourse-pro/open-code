import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendResendEmail } from "@/lib/email/resend";
import { arenaDigestEmail } from "@/lib/email/templates";
import { arenaLeaderboard, loadArenaMentors } from "@/lib/arena";
import { mentorScores } from "@/lib/mentor-score";
import { ARENA_ANSWER_POINTS, ARENA_HELPFUL_POINTS, NUDGE_AFTER_HOURS } from "@/lib/arena-shared";
import { getSiteUrl } from "@/lib/site";

export interface DigestResult {
  ok: true;
  open: number;
  stale: number;
  weekly: boolean;
  recipients: number;
  sent: number;
  skipped: number;
  failed: number;
  preview?: { name: string; ai: boolean; targeted: boolean; hasEmail: boolean }[];
  titles?: string[];
}

/**
 * The arena mail (the owner, 15/10 + 16/10): open questions to the mentors
 * who know AI (and to any mentor a question was addressed to), with their
 * points; on the weekly day, the leaderboard to EVERY active mentor, open
 * questions or not. Shared by the cron route and the team's "push now".
 */
export async function runArenaDigest(opts: { dry?: boolean; weekly?: boolean; everyone?: boolean }): Promise<DigestResult> {
  const admin = createAdminClient();
  const { data: open } = await admin
    .from("arena_questions")
    .select("id, title, target_mentor_id, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(200);
  const openCount = open?.length ?? 0;
  const staleEdge = Date.now() - NUDGE_AFTER_HOURS * 3600 * 1000;
  const stale = (open ?? []).filter((q) => new Date(q.created_at).getTime() < staleEdge).length;
  const weekly = !!opts.weekly;
  const targeted = new Set((open ?? []).map((q) => q.target_mentor_id).filter((x): x is string => !!x));
  const all = await loadArenaMentors();
  const mentors = opts.everyone || weekly ? all.filter((m) => m.available || targeted.has(m.id)) : all.filter((m) => (m.available && m.ai) || targeted.has(m.id));
  const base = { ok: true as const, open: openCount, stale, weekly };
  if (!weekly && openCount === 0) return { ...base, recipients: 0, sent: 0, skipped: 0, failed: 0 };
  if (mentors.length === 0) return { ...base, recipients: 0, sent: 0, skipped: 0, failed: 0 };

  const ids = mentors.map((m) => m.id);
  const [scores, { data: emailRows }, { data: profs }, leaders] = await Promise.all([
    mentorScores(ids),
    admin.rpc("member_emails", { p_ids: ids }),
    admin.from("profiles").select("id, first_name, full_name").in("id", ids),
    weekly ? arenaLeaderboard(5) : Promise.resolve([]),
  ]);
  const emailOf = new Map(((emailRows ?? []) as { id: string; email: string | null }[]).map((r) => [r.id, r.email]));
  const firstOf = new Map((profs ?? []).map((p) => [p.id, p.first_name ?? p.full_name?.split(" ")[0] ?? undefined]));
  const titles = (open ?? []).slice(0, 12).map((q) => q.title);
  const url = `${getSiteUrl()}/arena`;
  if (opts.dry) {
    return { ...base, recipients: mentors.length, sent: 0, skipped: 0, failed: 0, preview: mentors.map((m) => ({ name: m.name, ai: m.ai, targeted: targeted.has(m.id), hasEmail: !!emailOf.get(m.id) })), titles };
  }
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const m of mentors) {
    const email = emailOf.get(m.id);
    if (!email) {
      failed++;
      continue;
    }
    const s = scores.get(m.id);
    const mail = arenaDigestEmail(firstOf.get(m.id), {
      titles,
      open: openCount,
      stale,
      arenaPoints: (s?.arena ?? 0) * ARENA_ANSWER_POINTS + (s?.helpful ?? 0) * ARENA_HELPFUL_POINTS,
      totalScore: s?.score ?? 0,
      url,
      leaders: weekly ? leaders.map((l) => ({ name: l.name, points: l.points, helpful: l.helpful })) : undefined,
    });
    const r = await sendResendEmail({ to: email, subject: mail.subject, html: mail.html });
    if (r.ok) sent++;
    else if (r.error === "blocked_by_allowlist") skipped++;
    else {
      failed++;
      console.error("[arena-digest] failed:", m.id, r.error);
    }
  }
  return { ...base, recipients: mentors.length, sent, skipped, failed };
}
