// Audience criteria for the targeted-publish flow (admin-only, service role).
//
// Mirrors the employer portal's search catalogue (src/lib/portal/candidates.ts)
// but for the admin: EVERY active profile question becomes a criterion — not
// just the employer-visible ones — because the admin already sees full
// profiles. The catalogue (what the panel offers) and the pools (what each
// member "has") are built from the same label-resolving pass, so a value picked
// in the UI always compares against the same string on the member side.
//
// SERVER ONLY — never import this into a Client Component (types are fine via
// `import type`).

import { createAdminClient } from "@/lib/supabase/admin";
import { getTaxonomyOptions, type TaxonomyOption } from "@/lib/taxonomies";
import {
  DEFAULT_LANGUAGES,
  LANGUAGE_SKILLS_KEY,
  parseLangSkills,
} from "@/lib/language-skills";
import type { ConfigQuestion, TaxonomyKind } from "@/types/database";

/** One selectable criterion in the publish panel. Values are display labels. */
export interface AudienceCatalogueField {
  key: string;
  label: string;
  values: string[];
}

/** A member eligible for a targeted publish (before any criteria narrow it). */
export interface EligibleAudienceMember {
  id: string;
  full_name: string;
  is_experienced: boolean;
  status: string;
  /** Label-resolved, for display on the audience rows. */
  specialization: string | null;
  region: string | null;
}

export interface AudiencePools {
  members: EligibleAudienceMember[];
  /** profile id → question key → her values, label-resolved and lowercased. */
  pools: Map<string, Map<string, string[]>>;
}

/** Active profile questions that can apply to a junior member. */
async function loadQuestions(): Promise<ConfigQuestion[]> {
  const { data } = await createAdminClient()
    .from("config_questions")
    .select("*")
    .eq("active", true)
    // The publish audience is junior members — mentor-only questions can't
    // match anyone in it.
    .in("scope", ["junior", "all"])
    .order("sort_order", { ascending: true });
  return data ?? [];
}

/** Machine value → the label a human picked, for one question's options. */
function labelsFor(
  q: ConfigQuestion,
  taxonomies: Partial<Record<TaxonomyKind, TaxonomyOption[]>>
): Map<string, string> {
  const opts = q.taxonomy_kind
    ? taxonomies[q.taxonomy_kind] ?? []
    : Array.isArray(q.options)
      ? (q.options as unknown as { value: string; label: string }[])
      : [];
  return new Map(opts.map((o) => [o.value, o.label]));
}

/** A stored answer as display strings (labels, כן/לא, language names…). */
function answerValues(q: ConfigQuestion, raw: unknown, labels: Map<string, string>): string[] {
  if (q.key === LANGUAGE_SKILLS_KEY) return parseLangSkills(raw).map((s) => s.lang);
  if (Array.isArray(raw)) {
    return raw
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .map((v) => labels.get(v.trim()) ?? v.trim());
  }
  if (typeof raw === "boolean") return [raw ? "כן" : "לא"];
  if (typeof raw === "number" && Number.isFinite(raw)) return [String(raw)];
  if (typeof raw === "string" && raw.trim()) return [labels.get(raw.trim()) ?? raw.trim()];
  return [];
}

interface AudienceData {
  questions: ConfigQuestion[];
  taxonomies: Partial<Record<TaxonomyKind, TaxonomyOption[]>>;
  members: {
    id: string;
    full_name: string;
    specialization: string | null;
    region: string | null;
    is_experienced: boolean;
    status: string;
  }[];
  /** profile id → question key → label-resolved, deduped display values. */
  valuePools: Map<string, Map<string, string[]>>;
}

/** The eligible-audience profile query, or an id-scoped one (no gates). */
function profilesQuery(profileIds?: string[]) {
  const base = createAdminClient()
    .from("profiles")
    .select("id, full_name, specialization, region, is_experienced, status");
  // Id scope (e.g. a job's applicants): they're already in — she applied, so
  // she counts even if paused or with an incomplete profile. No gates.
  if (profileIds) return base.in("id", profileIds).order("full_name", { ascending: true });
  return (
    base
      // Placement reaches free members too (user decision 2026-07-29): pending =
      // browsing free member, active = paying. Only paused/rejected stay out.
      .in("status", ["active", "pending"])
      .eq("role", "junior")
      .eq("profile_completed", true)
      .order("full_name", { ascending: true })
  );
}

/**
 * The eligible members with everything they "have" per question key: the
 * denormalized profile columns (specialization/region — which may hold taxonomy
 * VALUES or Hebrew labels, so both resolve) plus their profile_answers, all as
 * display labels. One loader feeds both the catalogue and the matching pools.
 *
 * With `profileIds` the member set is scoped purely to those ids, WITHOUT the
 * eligibility gates above.
 */
async function loadAudienceData(profileIds?: string[]): Promise<AudienceData> {
  const admin = createAdminClient();
  const [{ data: profiles }, questions, taxonomies] = await Promise.all([
    profilesQuery(profileIds),
    loadQuestions(),
    getTaxonomyOptions(),
  ]);
  const members = profiles ?? [];

  const questionOf = new Map(questions.map((q) => [q.id, q]));
  const labelMapOf = new Map(questions.map((q) => [q.id, labelsFor(q, taxonomies)]));

  const answers: { profile_id: string; question_id: string; value: unknown }[] = [];
  if (members.length > 0) {
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data } = await admin
        .from("profile_answers")
        .select("profile_id, question_id, value")
        .in("profile_id", members.map((m) => m.id))
        .range(from, from + PAGE - 1);
      answers.push(...((data ?? []) as typeof answers));
      if (!data || data.length < PAGE) break;
    }
  }

  const valuePools = new Map<string, Map<string, string[]>>();
  const add = (profileId: string, key: string, values: string[]) => {
    if (values.length === 0) return;
    const mine = valuePools.get(profileId) ?? new Map<string, string[]>();
    const current = mine.get(key) ?? [];
    for (const v of values) if (!current.includes(v)) current.push(v);
    mine.set(key, current);
    valuePools.set(profileId, mine);
  };

  // Denormalized columns go in first, so pool[0] prefers them for display.
  const specLabels = new Map((taxonomies.specialization ?? []).map((o) => [o.value, o.label]));
  const regionLabels = new Map((taxonomies.region ?? []).map((o) => [o.value, o.label]));
  for (const m of members) {
    if (m.specialization) {
      add(m.id, "specialization", [specLabels.get(m.specialization) ?? m.specialization]);
    }
    if (m.region) add(m.id, "region", [regionLabels.get(m.region) ?? m.region]);
  }

  for (const a of answers) {
    const q = questionOf.get(a.question_id);
    if (!q) continue; // an inactive or non-junior question
    add(a.profile_id, q.key, answerValues(q, a.value, labelMapOf.get(q.id) ?? new Map()));
  }

  return { questions, taxonomies, members, valuePools };
}

/**
 * The criteria palette for the publish panel: every active profile question
 * with something discrete to pick — its defined options / taxonomy labels
 * unioned with values actually seen on eligible members. Free-text questions
 * are skipped (nothing discrete to offer); experience stays a separate select
 * in the panel.
 */
export async function buildAudienceCatalogue(
  profileIds?: string[]
): Promise<AudienceCatalogueField[]> {
  const { questions, taxonomies, members, valuePools } = await loadAudienceData(profileIds);
  // Id-scoped catalogues (a job's applicants) offer only values actually seen
  // in the scope — every chip matches at least one row, no dead chips.
  const scoped = profileIds !== undefined;

  const seenFor = (key: string): Set<string> => {
    const seen = new Set<string>();
    for (const m of members) {
      for (const v of valuePools.get(m.id)?.get(key) ?? []) seen.add(v);
    }
    return seen;
  };

  const out: AudienceCatalogueField[] = [];
  for (const q of questions) {
    if (q.key === LANGUAGE_SKILLS_KEY) {
      const langs = scoped
        ? seenFor(q.key)
        : new Set<string>([...DEFAULT_LANGUAGES, ...seenFor(q.key)]);
      if (langs.size) {
        out.push({
          key: q.key,
          label: q.label_he,
          values: [...langs].sort((a, b) => a.localeCompare(b, "he")),
        });
      }
      continue;
    }

    if (q.field_type === "bool") {
      const values = scoped
        ? ["כן", "לא"].filter((v) => seenFor(q.key).has(v))
        : ["כן", "לא"];
      if (values.length) out.push({ key: q.key, label: q.label_he, values });
      continue;
    }

    if (q.field_type === "select" || q.field_type === "multiselect" || q.field_type === "tags") {
      const defined = q.taxonomy_kind
        ? (taxonomies[q.taxonomy_kind] ?? []).map((o) => o.label)
        : Array.isArray(q.options)
          ? (q.options as unknown as { value: string; label: string }[]).map((o) => o.label)
          : [];
      const seen = seenFor(q.key);
      // Scoped: defined ordering first (only where seen), then free-typed extras.
      const union = scoped
        ? [...defined.filter((v) => seen.has(v)), ...seen]
        : [...defined, ...seen];
      const values = [...new Set(union)].filter((v) => v && v !== "other" && v !== "אחר");
      if (values.length) out.push({ key: q.key, label: q.label_he, values });
      continue;
    }

    if (q.field_type === "number") {
      const seen = seenFor(q.key);
      if (seen.size) {
        out.push({
          key: q.key,
          label: q.label_he,
          values: [...seen].sort((a, b) => Number(a) - Number(b)),
        });
      }
    }
    // Free-text questions aren't offered — there's nothing discrete to pick.
  }

  return out;
}

/**
 * The eligible members and their per-question value pools, lowercased for
 * case-insensitive matching against catalogue values. previewAudience filters
 * on these so the panel's chips and the matching can never drift apart.
 */
export async function loadAudiencePools(profileIds?: string[]): Promise<AudiencePools> {
  const { members, valuePools } = await loadAudienceData(profileIds);

  const pools = new Map<string, Map<string, string[]>>();
  const shaped = members.map((m) => {
    const mine = valuePools.get(m.id) ?? new Map<string, string[]>();
    pools.set(
      m.id,
      new Map([...mine].map(([key, values]) => [key, values.map((v) => v.trim().toLowerCase())]))
    );
    return {
      id: m.id,
      full_name: m.full_name,
      is_experienced: !!m.is_experienced,
      status: m.status,
      // The profile column was added to the pool first, so [0] prefers it and
      // falls back to her first intake answer — already label-resolved.
      specialization: mine.get("specialization")?.[0] ?? null,
      region: mine.get("region")?.[0] ?? null,
    };
  });

  return { members: shaped, pools };
}
