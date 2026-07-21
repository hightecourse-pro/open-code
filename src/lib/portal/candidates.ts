// Candidate data for the employer portal.
//
// PRIVACY CONTRACT — everything in this file obeys it:
//   * Only profiles that are active, completed and portal_listed appear.
//   * Only answers to questions flagged employer_visible are ever returned.
//     Anything not opted in (ID number, phone, address…) never leaves the DB.
//   * member_crm (VIP flag, VIP reason, internal notes) is never read here.

import { createAdminClient } from "@/lib/supabase/admin";
import { getTaxonomyOptions, type TaxonomyOption } from "@/lib/taxonomies";
import {
  DEFAULT_LANGUAGES,
  LANGUAGE_SKILLS_KEY,
  langLevelLabel,
  parseLangSkills,
} from "@/lib/language-skills";
import type { ConfigQuestion, TaxonomyKind } from "@/types/database";
import type { CandidateDetail, CandidateField, CatalogueField } from "./types";

// Shapes and the pure filter live in their own modules so the client filter UI
// can use them without pulling this server-only file into the browser bundle.
export type { CandidateDetail, CandidateField, CandidateSummary, CatalogueField } from "./types";
export { applyFilters, searchableText } from "./filters";

/** Free-text URLs in an answer become clickable project/repo links. */
const LINK_KEYS = new Set(["github", "ai_project_links", "portfolio", "links"]);

/**
 * Question labels are written for the member filling her profile ("מה התחום
 * שלך?"). A hiring client reads ABOUT her, so the portal swaps in neutral,
 * third-person labels. Unmapped keys fall back to the original label.
 */
const PORTAL_LABELS: Record<string, string> = {
  specialization: "תחום התמחות",
  tech_stack: "טכנולוגיות",
  dev_tech: "טכנולוגיות שתרגלה בפועל בהכשרה",
  genai_known: "ידע ב-GenAI",
  genai_practiced: "התנסות מעשית ב-GenAI (פרויקט)",
  ai_project_links: "פרויקטי AI",
  ai_tools_used: "כלי AI בשימוש בפועל",
  practicum_done: "ביצעה פרקטיקום / פרויקט עם לקוח אמיתי",
  practicum_employer: "המעסיק בפרקטיקום",
  practicum_tech: "טכנולוגיות הפרקטיקום",
  practicum_placement: "פתוחה להשמה דרך פרקטיקום",
  remote_commute: "נכונות להגעה למשרה היברידית מרוחקת",
  years_experience: "שנות ניסיון",
  exp_role: "תפקידים עם ניסיון",
  exp_tech: "טכנולוגיות מניסיון תעסוקתי",
  exp_languages: "שפות תכנות מניסיון",
  currently_working: "עובדת כיום",
  work_description: "תיאור התפקיד והעשייה",
  bio: "היכרות קצרה",
};

/** The label a portal client sees for a question. */
function portalLabel(q: ConfigQuestion): string {
  return PORTAL_LABELS[q.key] ?? q.label_he;
}

function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s,]+/g) ?? [];
}

async function employerQuestions(): Promise<ConfigQuestion[]> {
  const { data } = await createAdminClient()
    .from("config_questions")
    .select("*")
    .eq("employer_visible", true)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

/** Machine value → the label a human picked, for select/multiselect answers. */
function labelResolverFrom(taxonomies: Partial<Record<TaxonomyKind, TaxonomyOption[]>>) {
  return function labelsFor(q: ConfigQuestion): Map<string, string> {
    const opts = q.taxonomy_kind
      ? taxonomies[q.taxonomy_kind] ?? []
      : Array.isArray(q.options)
        ? (q.options as unknown as { value: string; label: string }[])
        : [];
    return new Map(opts.map((o) => [o.value, o.label]));
  };
}

function toDisplay(
  q: ConfigQuestion,
  raw: unknown,
  labels: Map<string, string>
): { values: string[]; kind: CandidateField["kind"] } {
  if (q.key === LANGUAGE_SKILLS_KEY) {
    return {
      values: parseLangSkills(raw).map((s) => `${s.lang} — ${langLevelLabel(s.level)}`),
      kind: "chips",
    };
  }
  if (Array.isArray(raw)) {
    const items = raw
      .filter((v): v is string => typeof v === "string")
      .map((v) => labels.get(v) ?? v);
    return { values: items, kind: "chips" };
  }
  if (typeof raw === "boolean") return { values: [raw ? "כן" : "לא"], kind: "text" };
  if (typeof raw === "number") return { values: [String(raw)], kind: "text" };
  if (typeof raw === "string" && raw.trim()) {
    if (LINK_KEYS.has(q.key)) {
      const urls = extractUrls(raw);
      if (urls.length) return { values: urls, kind: "links" };
    }
    return { values: [labels.get(raw) ?? raw], kind: q.field_type === "select" ? "chips" : "text" };
  }
  return { values: [], kind: "text" };
}

/**
 * The filter palette the recruiter sees. Built from the employer-visible
 * QUESTIONS (with their defined options / taxonomy values) unioned with any
 * values that actually occur in the data — so the parameters mirror the
 * profile structure and show up even before any candidate is listed.
 */
function buildCatalogue(
  questions: ConfigQuestion[],
  taxonomies: Partial<Record<TaxonomyKind, TaxonomyOption[]>>,
  candidates: CandidateDetail[]
): CatalogueField[] {
  const out: CatalogueField[] = [];

  for (const q of questions) {
    if (q.key === LANGUAGE_SKILLS_KEY) {
      const langs = new Set<string>(DEFAULT_LANGUAGES);
      for (const c of candidates) {
        for (const v of c.fields.find((f) => f.key === q.key)?.values ?? []) {
          const lang = v.split(" — ")[0]?.trim();
          if (lang) langs.add(lang);
        }
      }
      out.push({ key: q.key, label: portalLabel(q), values: [...langs].sort((a, b) => a.localeCompare(b, "he")) });
      continue;
    }

    if (q.field_type === "bool") {
      out.push({ key: q.key, label: portalLabel(q), values: ["כן", "לא"] });
      continue;
    }

    if (q.field_type === "select" || q.field_type === "multiselect" || q.field_type === "tags") {
      const defined = q.taxonomy_kind
        ? (taxonomies[q.taxonomy_kind] ?? []).map((o) => o.label)
        : Array.isArray(q.options)
          ? (q.options as unknown as { value: string; label: string }[]).map((o) => o.label)
          : [];
      const seen = new Set<string>();
      for (const c of candidates) {
        if (q.key === "specialization" && c.specialization) seen.add(c.specialization);
        else if (q.key === "region" && c.region) seen.add(c.region);
        else for (const v of c.fields.find((f) => f.key === q.key)?.values ?? []) seen.add(v);
      }
      const values = [...new Set([...defined, ...seen])].filter(
        (v) => v && v !== "other" && v !== "אחר"
      );
      if (values.length) out.push({ key: q.key, label: portalLabel(q), values });
      continue;
    }

    if (q.field_type === "number") {
      const seen = new Set<string>();
      for (const c of candidates) {
        for (const v of c.fields.find((f) => f.key === q.key)?.values ?? []) seen.add(v);
      }
      if (seen.size) {
        out.push({
          key: q.key,
          label: portalLabel(q),
          values: [...seen].sort((a, b) => Number(a) - Number(b)),
        });
      }
    }
    // Free text fields aren't offered as chips — the free-text search covers them.
  }

  return out;
}

/** Every listed candidate, with only employer-visible answers attached. */
export async function loadCandidates(): Promise<{
  candidates: CandidateDetail[];
  questions: ConfigQuestion[];
  catalogue: CatalogueField[];
}> {
  const admin = createAdminClient();
  const [questions, taxonomies] = await Promise.all([employerQuestions(), getTaxonomyOptions()]);
  const visibleIds = new Set(questions.map((q) => q.id));
  // The profiles row carries denormalized copies of a few answers. Honor the
  // employer_visible flag for these too — hiding the question hides the column.
  const visibleKeys = new Set(questions.map((q) => q.key));
  const showBio = visibleKeys.has("bio");
  const showSpecialization = visibleKeys.has("specialization");
  const showRegion = visibleKeys.has("region");
  const labelsFor = labelResolverFrom(taxonomies);

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, avatar_initials, specialization, region, bio, is_experienced, portal_listed, status, profile_completed")
    .eq("status", "active")
    .eq("profile_completed", true)
    // Only job-seeking members — never admins or mentors.
    .eq("role", "junior")
    .order("full_name", { ascending: true });

  const listed = (profiles ?? []).filter((p) => p.portal_listed !== false);
  // No candidates yet — still return the full filter palette from the questions
  // so the recruiter sees the parameters that mirror the profile.
  if (listed.length === 0) {
    return { candidates: [], questions, catalogue: buildCatalogue(questions, taxonomies, []) };
  }

  // Answers are fetched for the listed members only, then filtered down to the
  // employer-visible questions before anything is returned.
  const answers: { profile_id: string; question_id: string; value: unknown }[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data } = await admin
      .from("profile_answers")
      .select("profile_id, question_id, value")
      .in("profile_id", listed.map((p) => p.id))
      .range(from, from + PAGE - 1);
    answers.push(...((data ?? []) as typeof answers));
    if (!data || data.length < PAGE) break;
  }

  const byMember = new Map<string, Map<string, unknown>>();
  for (const a of answers) {
    if (!visibleIds.has(a.question_id)) continue; // the privacy gate
    const m = byMember.get(a.profile_id) ?? new Map();
    m.set(a.question_id, a.value);
    byMember.set(a.profile_id, m);
  }

  const candidates: CandidateDetail[] = listed.map((p) => {
    const mine = byMember.get(p.id) ?? new Map();
    const fields: CandidateField[] = [];
    const links: { label: string; url: string }[] = [];

    for (const q of questions) {
      if (!mine.has(q.id)) continue;
      const { values, kind } = toDisplay(q, mine.get(q.id), labelsFor(q));
      if (values.length === 0) continue;
      if (kind === "links") {
        for (const url of values) links.push({ label: portalLabel(q), url });
        continue;
      }
      fields.push({ key: q.key, label: portalLabel(q), values, kind });
    }

    const headline = fields
      .filter((f) => ["dev_tech", "tech_stack", "exp_tech"].includes(f.key))
      .flatMap((f) => f.values)
      .slice(0, 6);

    return {
      id: p.id,
      name: p.full_name || "מועמדת",
      initials: p.avatar_initials || p.full_name?.slice(0, 1) || "ק",
      specialization: showSpecialization ? p.specialization : null,
      region: showRegion ? p.region : null,
      bio: showBio ? p.bio : null,
      isExperienced: !!p.is_experienced,
      headline,
      fields,
      links,
    };
  });

  return { candidates, questions, catalogue: buildCatalogue(questions, taxonomies, candidates) };
}

