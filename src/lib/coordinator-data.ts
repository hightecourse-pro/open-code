// The coordinator portal's data layer — everything is scoped by HER
// institutions, fetched with the service role (the tables are service-role
// only) after the signed session already proved who she is.

import { createAdminClient } from "@/lib/supabase/admin";

export interface Graduate {
  id: string;
  full_name: string;
  avatar_initials: string | null;
  specialization: string | null;
  status: string;
  institution: string;
  /** graduation_year option VALUE ("5785"…) — label resolved by the caller. */
  yearValue: string | null;
  /** certificate option VALUE — label resolved by the caller. */
  certificateValue: string | null;
  /** The system's own placement fact (profiles.found_job). */
  systemFoundJob: boolean;
}

export interface CoordinatorReview {
  profile_id: string;
  communication: number | null;
  talent: number | null;
  note: string | null;
  found_job: boolean | null;
  found_job_place: string | null;
  updated_at: string;
}

export interface OptionLabels {
  years: Map<string, string>;
  certificates: Map<string, string>;
}

/** Option labels for graduation years and certificates. */
export async function loadOptionLabels(): Promise<OptionLabels> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("config_questions")
    .select("key, options")
    .in("key", ["graduation_year", "certificate"]);
  const mapOf = (key: string) =>
    new Map(
      ((data ?? []).find((q) => q.key === key)?.options as { value: string; label: string }[] | null ?? []).map(
        (o) => [o.value, o.label]
      )
    );
  return { years: mapOf("graduation_year"), certificates: mapOf("certificate") };
}

/** All graduates of the given institutions (rejected/hidden stay out). */
export async function loadGraduates(institutions: string[]): Promise<Graduate[]> {
  if (institutions.length === 0) return [];
  const admin = createAdminClient();

  const { data: qs } = await admin
    .from("config_questions")
    .select("id, key")
    .in("key", ["study_place", "graduation_year", "certificate"]);
  const qid = (key: string) => (qs ?? []).find((q) => q.key === key)?.id;
  const placeQ = qid("study_place");
  if (!placeQ) return [];

  // Whose study_place is one of hers. The answer value is jsonb — comparing
  // it in PostgREST is brittle, so the (bounded) answer set is filtered here.
  const wanted = new Set(institutions);
  const instOf = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data: placeRows } = await admin
      .from("profile_answers")
      .select("profile_id, value")
      .eq("question_id", placeQ)
      .range(from, from + 999);
    for (const r of placeRows ?? []) {
      if (typeof r.value === "string" && wanted.has(r.value)) instOf.set(r.profile_id, r.value);
    }
    if (!placeRows || placeRows.length < 1000) break;
  }
  const ids = [...instOf.keys()];
  if (ids.length === 0) return [];

  const [{ data: profs }, { data: yearRows }, { data: certRows }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, avatar_initials, specialization, status, found_job, is_hidden")
      .in("id", ids),
    qid("graduation_year")
      ? admin.from("profile_answers").select("profile_id, value").eq("question_id", qid("graduation_year")!).in("profile_id", ids)
      : Promise.resolve({ data: [] }),
    qid("certificate")
      ? admin.from("profile_answers").select("profile_id, value").eq("question_id", qid("certificate")!).in("profile_id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const yearOf = new Map((yearRows ?? []).map((r) => [r.profile_id, typeof r.value === "string" ? r.value : null]));
  const certOf = new Map((certRows ?? []).map((r) => [r.profile_id, typeof r.value === "string" ? r.value : null]));

  return (profs ?? [])
    .filter((p) => p.status !== "rejected" && p.is_hidden !== true)
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_initials: p.avatar_initials,
      specialization: p.specialization,
      status: p.status,
      institution: instOf.get(p.id) ?? institutions[0],
      yearValue: yearOf.get(p.id) ?? null,
      certificateValue: certOf.get(p.id) ?? null,
      systemFoundJob: p.found_job === true,
    }));
}

/** HER reviews only — a colleague's notes never leave the service role. */
export async function loadReviews(contactId: string): Promise<Map<string, CoordinatorReview>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("coordinator_reviews")
    .select("profile_id, communication, talent, note, found_job, found_job_place, updated_at")
    .eq("contact_id", contactId);
  return new Map((data ?? []).map((r) => [r.profile_id, r as CoordinatorReview]));
}

export interface CoordinatorJob {
  id: string;
  title: string;
  status: string;
  pipeline_status: string;
  published_at: string | null;
  /** HER graduates who applied — names only. */
  applicants: { id: string; full_name: string; status: string }[];
}

/** Our published jobs + which of HER graduates applied to each. */
export async function loadJobsWithHerApplicants(graduateIds: string[]): Promise<CoordinatorJob[]> {
  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("jobs")
    .select("id, title, status, pipeline_status, published_at")
    .eq("source", "ours")
    .neq("pipeline_status", "draft")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(60);
  if (!jobs?.length) return [];

  const { data: apps } = graduateIds.length
    ? await admin
        .from("applications")
        .select("job_id, applicant_id, status")
        .in("applicant_id", graduateIds)
        .in("job_id", jobs.map((j) => j.id))
        .neq("status", "draft")
    : { data: [] };
  const { data: names } = graduateIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", graduateIds)
    : { data: [] };
  const nameOf = new Map((names ?? []).map((p) => [p.id, p.full_name]));

  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    pipeline_status: j.pipeline_status,
    published_at: j.published_at,
    applicants: (apps ?? [])
      .filter((a) => a.job_id === j.id)
      .map((a) => ({ id: a.applicant_id, full_name: nameOf.get(a.applicant_id) ?? "בוגרת", status: a.status })),
  }));
}

export interface CoordinatorHire {
  full_name: string;
  hired_at: string | null;
}

/** Placements of HER graduates — names and dates; workplaces stay private. */
export async function loadHires(graduateIds: string[]): Promise<CoordinatorHire[]> {
  if (graduateIds.length === 0) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("hires")
    .select("full_name, hired_at, profile_id")
    .in("profile_id", graduateIds)
    .order("hired_at", { ascending: false, nullsFirst: false });
  return (data ?? []).map((h) => ({ full_name: h.full_name, hired_at: h.hired_at }));
}
