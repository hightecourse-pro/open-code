// Client-safe types and helpers of גמר ההאקתון בשידור חי (the owner, 26/10):
// the hall screen (/live), the judges' page (/live/judge/<token>) and the
// control panel share these; the server logic lives in hackathon-live.ts.
//
// Every criterion has an owner: the judges score theirs 1-10 from their phones,
// the audience picks the best project per criterion in a phone vote. The final
// score is one weighted sum - judges 70, audience 30 by default.

export const LIVE_SCALE = 10;
export const LIVE_MAX_FINALISTS = 9; // phone keys 1-9
export const LIVE_MIN_FINALISTS = 2;
export const LIVE_MAX_OPTIONS = 9;
export const LIVE_MIN_OPTIONS = 2;

export type LiveOwner = "judges" | "audience";

export interface LiveCriterion {
  key: string;
  label: string;
  weight: number;
  owner: LiveOwner;
  hint: string;
}

export type LiveQuestionStatus = "idle" | "open" | "closed";
export type LiveChallengeStatus = "idle" | "judging" | "closed";
export type LiveReveal = "live" | "end";
export type LiveAudienceMode = "leader" | "share";

export interface LiveOption {
  n: number;
  label: string;
  /** Hidden from the hall while a "בסיום" question is open. */
  count?: number;
  pct?: number;
  leading?: boolean;
}

export interface LiveQuestionView {
  id: string;
  text: string;
  options: LiveOption[];
  reveal: LiveReveal;
  status: LiveQuestionStatus;
  challengeKey: string | null;
  /** An audience vote of the finals: which criterion, under which challenge. */
  category: { key: string; label: string; challenge: string } | null;
  openedAt: string | null;
}

export interface LiveJudgeCell {
  judgeId: string;
  name: string;
  total: number | null;
  filled: number;
}

export interface LiveAudienceCell {
  /** Operator only - the hall sees percentages, never counts (the approved design). */
  count?: number;
  pct: number;
  /** Points out of the criterion's weight; null until anyone voted. */
  score: number | null;
  leading: boolean;
}

export interface LiveFinalistRow {
  id: string;
  n: number;
  name: string;
  team: string;
  judged: number;
  judgesTotal: number;
  /** Points out of the judges' share; null until a judge completed her scoring. */
  judgesScore: number | null;
  /** Per audience criterion key. */
  audience: Record<string, LiveAudienceCell>;
  total: number | null;
  rank: number | null;
  judges?: LiveJudgeCell[];
}

export interface LiveCategoryView {
  key: string;
  label: string;
  weight: number;
  /** Operator only. */
  voted?: number;
  /** The finalist leading this audience vote (null while nobody voted or on a tie). */
  winner: string | null;
}

export interface LiveStep {
  key: string;
  label: string;
  status: "done" | "open" | "next";
  questionId: string | null;
  openedAt: string | null;
}

export interface LiveFinalsView {
  active: string | null;
  /** The ballot's walk through the audience criteria, in order. */
  steps?: LiveStep[];
  name?: string;
  org?: string;
  logos?: string[];
  status?: LiveChallengeStatus;
  revealed?: boolean;
  reveal?: LiveReveal;
  hidden?: boolean;
  currentId?: string | null;
  weights?: { judges: number; audience: number };
  judgesTotal?: number;
  categories?: LiveCategoryView[];
  finalists?: LiveFinalistRow[];
}

export interface LiveDisplayView {
  event: { name: string; phone: string; theme: "light" | "dark"; voteSeconds: number };
  question: LiveQuestionView | null;
  resultsVisible: boolean;
  voted: number;
  changed: number;
  invalid: number;
  connected: number | null;
  finals: LiveFinalsView;
  health: { configured: boolean; lastPollAt: string | null; error: string | null };
  updatedAt: string;
}

export interface LiveAdminQuestion {
  id: string;
  text: string;
  options: string[];
  sort: number;
  challengeKey: string | null;
  criterionKey: string | null;
  status: LiveQuestionStatus;
  reveal: LiveReveal;
  voted: number;
  current: boolean;
}

export interface LiveAdminChallenge {
  key: string;
  name: string;
  org: string;
  logos: string[];
  status: LiveChallengeStatus;
  revealed: boolean;
  currentId: string | null;
  judgesTotal: number;
  categories: LiveCategoryView[];
  finalists: LiveFinalistRow[];
  finalistsRaw: { id: string; n: number; name: string; team: string; teamKey: string | null }[];
}

export interface LiveAdminView extends LiveDisplayView {
  settings: {
    eventName: string;
    phoneDisplay: string;
    hasToken: boolean;
    yemotExtension: string;
    judgeCode: string;
    voteSeconds: number;
    weights: { judges: number; audience: number };
    audienceMode: LiveAudienceMode;
    reveal: LiveReveal;
    theme: "light" | "dark";
    criteria: LiveCriterion[];
    activeChallenge: string | null;
  };
  questions: LiveAdminQuestion[];
  challenges: LiveAdminChallenge[];
  judges: { id: string; name: string; challengeKey: string | null; token: string; scored: number; createdAt: string }[];
}

export interface LiveJudgeFinalist {
  id: string;
  n: number;
  name: string;
  team: string;
  scores: Record<string, number>;
  total: number;
  complete: boolean;
  filled: number;
}

export interface LiveJudgeView {
  ok: true;
  judge: { id: string; name: string };
  challenge: { key: string; name: string; org: string; logos: string[]; status: LiveChallengeStatus; currentId: string | null } | null;
  /** The judges' criteria only. */
  criteria: LiveCriterion[];
  scale: number;
  /** What a complete scoring adds up to - the judges' share of 100. */
  maxTotal: number;
  finalists: LiveJudgeFinalist[];
  updatedAt: string;
}

export const round1 = (x: number) => Math.round(x * 10) / 10;
export const judgesCriteria = (criteria: LiveCriterion[]) => criteria.filter((c) => c.owner === "judges");
export const audienceCriteria = (criteria: LiveCriterion[]) => criteria.filter((c) => c.owner === "audience");
export const weightSum = (criteria: LiveCriterion[]) => round1(criteria.reduce((s, c) => s + c.weight, 0));

/** One judge's weighted points for one finalist over the judges' criteria; complete only when every one is scored. */
export function judgeTotal(scores: Record<string, number | undefined>, criteria: LiveCriterion[], scale = LIVE_SCALE): { total: number; complete: boolean; filled: number } {
  const mine = judgesCriteria(criteria);
  let total = 0;
  let filled = 0;
  for (const c of mine) {
    const v = scores[c.key];
    if (typeof v === "number" && Number.isFinite(v)) {
      total += (v / scale) * c.weight;
      filled += 1;
    }
  }
  return { total: round1(total), complete: filled === mine.length && filled > 0, filled };
}

/** "שם הפרויקט | הצוות" lines from the control panel's textarea. */
export function parseFinalistLines(text: string): { name: string; team: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, ...rest] = l.split("|");
      return { name: name.trim(), team: rest.join("|").trim() };
    })
    .filter((f) => f.name);
}
