// Candidate↔job matching for the finder tab (the owner, 2/9). The one rule
// that matters: technology matches count ONLY from PRACTICAL sources — the
// work-history entries, the practicum, the legacy from-work answer. Never
// from "טכנולוגיות שלמדת" — לימודים יש לכולן וזה לא משנה (the owner).

import { createAdminClient } from "@/lib/supabase/admin";
import { getTaxonomyOptions } from "@/lib/taxonomies";

/** Practical-tech question keys. dev_tech (learning) is deliberately absent. */
const PRACTICAL_TECH_KEYS = ["practicum_tech", "exp_tech", "mentor_tech"] as const;
const WORK_HISTORY_KEY = "work_history";
const YEARS_KEY = "years_experience";

export interface CandidateMatch {
  profileId: string;
  /** 0–100: share of the job's required tags she has from PRACTICE. */
  score: number;
  /** Job tags she has practical experience with (display labels). */
  matched: string[];
  /** Job tags she lacks (display labels). */
  missing: string[];
  /** Practical tech beyond the job's asks (labels, capped) — context. */
  extra: string[];
  years: number | null;
}

/** Normalize any tech token (taxonomy value OR label) to a canonical key. */
function keyify(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s._\-/]+/g, "");
}

export async function matchCandidates(
  jobTechTags: string[],
  profileIds: string[]
): Promise<Map<string, CandidateMatch>> {
  const admin = createAdminClient();
  const out = new Map<string, CandidateMatch>();
  if (!profileIds.length) return out;

  // value↔label resolution, both directions — job tags and answers may hold
  // either shape.
  const tax = await getTaxonomyOptions();
  const labelOf = new Map<string, string>();
  for (const o of tax.tech ?? []) {
    labelOf.set(keyify(o.value), o.label);
    labelOf.set(keyify(o.label), o.label);
  }
  const display = (raw: string): string => labelOf.get(keyify(raw)) ?? raw.trim();

  const required = [...new Set(jobTechTags.map(keyify))].filter(Boolean);

  const { data: questions } = await admin
    .from("config_questions")
    .select("id, key")
    .in("key", [...PRACTICAL_TECH_KEYS, WORK_HISTORY_KEY, YEARS_KEY]);
  const idOf = new Map((questions ?? []).map((q) => [q.key, q.id]));
  const qIds = (questions ?? []).map((q) => q.id);
  if (!qIds.length) return out;

  const answers: { profile_id: string; question_id: string; value: unknown }[] = [];
  for (let i = 0; i < profileIds.length; i += 300) {
    const { data } = await admin
      .from("profile_answers")
      .select("profile_id, question_id, value")
      .in("question_id", qIds)
      .in("profile_id", profileIds.slice(i, i + 300));
    answers.push(...(data ?? []));
  }

  const practicalOf = new Map<string, Set<string>>();
  const yearsOf = new Map<string, number>();
  const workQ = idOf.get(WORK_HISTORY_KEY);
  const yearsQ = idOf.get(YEARS_KEY);
  const techQIds = new Set(
    PRACTICAL_TECH_KEYS.map((k) => idOf.get(k)).filter((x): x is string => !!x)
  );

  const add = (pid: string, raw: string) => {
    let set = practicalOf.get(pid);
    if (!set) practicalOf.set(pid, (set = new Set()));
    set.add(keyify(raw));
  };

  for (const a of answers) {
    if (techQIds.has(a.question_id) && Array.isArray(a.value)) {
      for (const v of a.value) if (typeof v === "string") add(a.profile_id, v);
    } else if (a.question_id === workQ) {
      // The work-history sequence: [{place, tech: [...], ...}, ...] — the
      // answer may arrive as a JSON array or as its stringified form.
      const rows = Array.isArray(a.value)
        ? a.value
        : typeof a.value === "string"
          ? (() => {
              try {
                const p = JSON.parse(a.value);
                return Array.isArray(p) ? p : [];
              } catch {
                return [];
              }
            })()
          : [];
      for (const w of rows as { tech?: unknown }[]) {
        if (Array.isArray(w?.tech)) {
          for (const t of w.tech) if (typeof t === "string") add(a.profile_id, t);
        }
      }
    } else if (a.question_id === yearsQ) {
      const n = Number(a.value);
      if (Number.isFinite(n)) yearsOf.set(a.profile_id, n);
    }
  }

  for (const pid of profileIds) {
    const have = practicalOf.get(pid) ?? new Set<string>();
    const matched: string[] = [];
    const missing: string[] = [];
    for (const req of required) {
      if (have.has(req)) matched.push(display(req));
      else missing.push(display(req));
    }
    const extra = [...have]
      .filter((k) => !required.includes(k))
      .slice(0, 12)
      .map(display);
    out.set(pid, {
      profileId: pid,
      score: required.length ? Math.round((matched.length / required.length) * 100) : 0,
      matched,
      missing,
      extra,
      years: yearsOf.get(pid) ?? null,
    });
  }
  return out;
}
