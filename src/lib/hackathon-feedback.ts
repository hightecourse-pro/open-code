import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import { CRITERIA, readAutoReport, type AutoReport } from "@/lib/judging-shared";
import { scrubNote, type MemberFeedback } from "@/lib/hackathon-feedback-shared";
import { PROJECTS } from "@/lib/hackathon-showcase";
import { CHALLENGES } from "@/app/hackathon-2026/shared";
import { loadAdminSubmissions } from "@/lib/hackathon-submission";

/*
  המשוב לצוותים (the owner, 5/11): the automated review's note per criterion,
  shown to the team that built the project - once the owner opens it. One
  app_settings row holds the switch, like the submissions' closure; the
  team's page shows the card only while it is on and only for a team whose
  report exists.
*/
const KEY = "hackathon_feedback";

export interface FeedbackPublication {
  publishedAt: string | null;
  publishedBy: string | null;
}

export async function getFeedbackPublication(): Promise<FeedbackPublication> {
  try {
    const { data } = await createAdminClient().from("app_settings").select("value").eq("key", KEY).maybeSingle();
    const v = (data?.value ?? {}) as { published_at?: unknown; published_by?: unknown };
    return { publishedAt: typeof v.published_at === "string" && v.published_at ? v.published_at : null, publishedBy: typeof v.published_by === "string" ? v.published_by : null };
  } catch {
    return { publishedAt: null, publishedBy: null };
  }
}

export async function setFeedbackPublication(on: boolean, byId: string): Promise<void> {
  const value = on ? { published_at: new Date().toISOString(), published_by: byId } : { published_at: null, published_by: byId };
  const { error } = await createAdminClient()
    .from("app_settings")
    .upsert({ key: KEY, value: value as unknown as Json }, { onConflict: "key" });
  if (error) throw error;
}

/** The team's version of a report: every criterion that has a note, scrubbed; the blocker, scrubbed. */
export function memberFeedbackOf(report: AutoReport, updatedAt: string | null, finalist: boolean): MemberFeedback {
  const read = readAutoReport(report);
  return {
    ranAt: report.ranAt ?? updatedAt,
    finalist,
    blocked: read.blocked ? scrubNote(read.blocked) : null,
    criteria: CRITERIA.map((c) => ({ key: c.key, label: c.label, hint: c.hint, text: scrubNote(read.notes[c.key] ?? "") })).filter((c) => c.text),
  };
}

export async function loadTeamFeedback(teamKey: string): Promise<MemberFeedback | null> {
  const { data } = await createAdminClient().from("hackathon_auto_reports").select("report, updated_at").eq("team_key", teamKey).maybeSingle();
  if (!data) return null;
  const fb = memberFeedbackOf(data.report as AutoReport, data.updated_at, isFinalist(teamKey));
  return fb.criteria.length ? fb : null;
}

/** The finals of 28.10, as the public catalogue records them (tools/finals-rank.mjs → showcase-build.mjs). */
export function isFinalist(teamKey: string): boolean {
  return !!PROJECTS.find((p) => p.teamKey === teamKey)?.finalist;
}

export interface FeedbackTeam {
  teamKey: string;
  names: string[];
  finalist: boolean;
  challengeKey: string;
  challengeShort: string;
  ranAt: string | null;
  blocked: boolean;
  /** Whether a submission row exists here - on staging the reports are copies and the teams are not. */
  submitted: boolean;
}

/** Every report, named from the submission when there is one, else from the public catalogue's data. */
export async function loadFeedbackTeams(): Promise<FeedbackTeam[]> {
  const [{ data: reports }, submissions] = await Promise.all([createAdminClient().from("hackathon_auto_reports").select("team_key, report, updated_at").limit(1000), loadAdminSubmissions()]);
  const subOf = new Map(submissions.map((s) => [s.teamKey, s]));
  const pubOf = new Map(PROJECTS.map((p) => [p.teamKey, p]));
  const order = new Map(CHALLENGES.map((c, i) => [c.key, i]));
  const rows: FeedbackTeam[] = [];
  for (const r of reports ?? []) {
    const sub = subOf.get(r.team_key);
    const pub = pubOf.get(r.team_key);
    const challengeKey = sub?.challengeKey ?? pub?.challenge ?? "";
    const names = sub ? sub.members.map((m) => m.name) : (pub?.members.map((m) => m.name) ?? [r.team_key.slice(0, 8)]);
    const fb = memberFeedbackOf((r.report ?? {}) as AutoReport, r.updated_at, !!pub?.finalist);
    if (!fb.criteria.length) continue;
    rows.push({ teamKey: r.team_key, names, finalist: fb.finalist, challengeKey, challengeShort: CHALLENGES.find((c) => c.key === challengeKey)?.short ?? challengeKey, ranAt: fb.ranAt, blocked: !!fb.blocked, submitted: !!sub });
  }
  return rows.sort((a, b) => (order.get(a.challengeKey) ?? 9) - (order.get(b.challengeKey) ?? 9) || a.names[0].localeCompare(b.names[0], "he"));
}
