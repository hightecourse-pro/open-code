// The coordinator portal's data layer — everything is scoped by HER
// institutions, fetched with the service role (the tables are service-role
// only) after the signed session already proved who she is.

import { createAdminClient } from "@/lib/supabase/admin";
import { nameWithPrevSurname } from "@/lib/names";

/**
 * Display names for the coordinator portal: "שם (שם משפחה קודם)" whenever a
 * previous surname exists (the owner, 15/9: seminary records live under the
 * maiden name — "הוא צריך תמיד להופיע בסוגריים").
 */
async function displayNamesOf(profileIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (profileIds.length === 0) return out;
  const admin = createAdminClient();
  const { data: q } = await admin
    .from("config_questions")
    .select("id")
    .eq("key", "prev_surname")
    .maybeSingle();
  const [{ data: profs }, { data: prevRows }] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", profileIds),
    q
      ? admin.from("profile_answers").select("profile_id, value").eq("question_id", q.id).in("profile_id", profileIds)
      : Promise.resolve({ data: [] as { profile_id: string; value: unknown }[] }),
  ]);
  const prevOf = new Map(
    (prevRows ?? []).map((r) => [r.profile_id, typeof r.value === "string" ? r.value : null])
  );
  for (const p of profs ?? []) out.set(p.id, nameWithPrevSurname(p.full_name, prevOf.get(p.id)));
  return out;
}

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
  /** study_place option value → label (values are codes on some envs). */
  places: Map<string, string>;
}

/** Option labels for graduation years, certificates and institutions. */
export async function loadOptionLabels(): Promise<OptionLabels> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("config_questions")
    .select("key, options")
    .in("key", ["graduation_year", "certificate", "study_place"]);
  const mapOf = (key: string) =>
    new Map(
      ((data ?? []).find((q) => q.key === key)?.options as { value: string; label: string }[] | null ?? []).map(
        (o) => [o.value, o.label]
      )
    );
  return {
    years: mapOf("graduation_year"),
    certificates: mapOf("certificate"),
    places: mapOf("study_place"),
  };
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
      .select("id, full_name, avatar_initials, specialization, status, role, found_job, is_hidden")
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

  const nameOf = await displayNamesOf(ids);
  return (profs ?? [])
    // Graduates only (the owner, 15/9: "אין צורך שהמנטוריות יופיעו בבוגרות")
    // — mentors and staff who once studied there are not her placement story.
    .filter((p) => p.role === "junior" && p.status !== "rejected" && p.is_hidden !== true)
    .map((p) => ({
      id: p.id,
      full_name: nameOf.get(p.id) ?? p.full_name,
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
  /** Company only for market jobs — client names of OUR jobs stay private,
   *  exactly like the member board. */
  company: string | null;
  location: string | null;
  employment_type: string | null;
  /** The job description as plain text (the owner, 15/9: "לא כתוב את פרטי המשרה"). */
  descriptionText: string;
  /** HER graduates who applied. sentByUs = we forwarded her to the employer. */
  applicants: { id: string; full_name: string; status: string; sentByUs: boolean }[];
}

/**
 * Only jobs HER graduates actually applied to through the site (the owner,
 * 15/9: "משרות רק את אלה שההגשות בוצעו דרך האתר") — an application row IS a
 * through-the-site submission, so the list starts from her applications.
 */
export async function loadJobsWithHerApplicants(graduateIds: string[]): Promise<CoordinatorJob[]> {
  if (graduateIds.length === 0) return [];
  const admin = createAdminClient();
  // Two roads to a job row: she applied through the site, or WE submitted
  // her proactively (job_candidates with a sent stamp). "הוגשה ע"י קוד פתוח"
  // = any of: the client-send stamp, a post-send status, the team's אישור
  // סופי (submissions often go out by plain email, leaving only the mark —
  // the owner, 15/9: תמר פוקס/עדינה טיטלבוים), or a stamped curation row.
  const [{ data: apps }, { data: sentCands }] = await Promise.all([
    admin
      .from("applications")
      .select("job_id, applicant_id, status, sent_to_client_at, admin_mark")
      .in("applicant_id", graduateIds)
      .neq("status", "draft"),
    admin
      .from("job_candidates")
      .select("job_id, profile_id, sent_at")
      .in("profile_id", graduateIds)
      .not("sent_at", "is", null),
  ]);
  if (!apps?.length && !sentCands?.length) return [];

  const jcSent = new Set((sentCands ?? []).map((c) => `${c.job_id}:${c.profile_id}`));
  const jobIds = [
    ...new Set([...(apps ?? []).map((a) => a.job_id), ...(sentCands ?? []).map((c) => c.job_id)]),
  ];
  const applicantIds = [
    ...new Set([...(apps ?? []).map((a) => a.applicant_id), ...(sentCands ?? []).map((c) => c.profile_id)]),
  ];
  const [{ data: jobs }, nameOf] = await Promise.all([
    admin
      .from("jobs")
      .select("id, title, status, pipeline_status, published_at, source, company, location, employment_type, description, description_html")
      .in("id", jobIds)
      .neq("pipeline_status", "draft")
      .order("published_at", { ascending: false, nullsFirst: false }),
    displayNamesOf(applicantIds),
  ]);
  const { htmlToPlainText } = await import("@/lib/rich-text");

  return (jobs ?? [])
    .map((j) => {
      const jobApps = (apps ?? []).filter((a) => a.job_id === j.id);
      const applicants = jobApps.map((a) => ({
        id: a.applicant_id,
        full_name: nameOf.get(a.applicant_id) ?? "בוגרת",
        status: a.status,
        sentByUs:
          !!a.sent_to_client_at ||
          ["sent", "interview", "exam", "hired"].includes(a.status) ||
          a.admin_mark === "approved" ||
          jcSent.has(`${j.id}:${a.applicant_id}`),
      }));
      // Proactively-submitted graduates who never applied themselves.
      for (const c of (sentCands ?? []).filter((c) => c.job_id === j.id)) {
        if (applicants.some((a) => a.id === c.profile_id)) continue;
        applicants.push({
          id: c.profile_id,
          full_name: nameOf.get(c.profile_id) ?? "בוגרת",
          status: "sent",
          sentByUs: true,
        });
      }
      return {
        id: j.id,
        title: j.title,
        status: j.status,
        pipeline_status: j.pipeline_status,
        published_at: j.published_at,
        company: j.source !== "ours" ? (j.company ?? null) : null,
        location: j.location ?? null,
        employment_type: j.employment_type ?? null,
        descriptionText: j.description_html
          ? htmlToPlainText(j.description_html)
          : (j.description ?? ""),
        applicants,
      };
    })
    .filter((j) => j.applicants.length > 0);
}

export interface CoordinatorHire {
  full_name: string;
  hired_at: string | null;
}

/**
 * Placements of her institutions — names and dates; workplaces stay private.
 * Two roads in (the owner, 16/9: "רואה רק גיוס אחד למרות שבמערכת יש יותר"):
 * a hire linked to one of HER graduates, or any hire whose own seminary
 * field carries her institution — covering external hires and members whose
 * questionnaire never named the seminary.
 */
export async function loadHires(
  graduateIds: string[],
  institutions: string[] = []
): Promise<CoordinatorHire[]> {
  if (graduateIds.length === 0 && institutions.length === 0) return [];
  const admin = createAdminClient();
  const [{ data: byGrad }, { data: bySeminary }] = await Promise.all([
    graduateIds.length
      ? admin
          .from("hires")
          .select("id, full_name, hired_at, profile_id")
          .in("profile_id", graduateIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; hired_at: string | null; profile_id: string | null }[] }),
    institutions.length
      ? admin
          .from("hires")
          .select("id, full_name, hired_at, profile_id")
          .in("seminary", institutions)
      : Promise.resolve({ data: [] as { id: string; full_name: string; hired_at: string | null; profile_id: string | null }[] }),
  ]);
  const seen = new Set<string>();
  const rows = [...(byGrad ?? []), ...(bySeminary ?? [])].filter((h) => {
    if (seen.has(h.id)) return false;
    seen.add(h.id);
    return true;
  });
  const nameOf = await displayNamesOf(
    [...new Set(rows.map((h) => h.profile_id).filter((v): v is string => !!v))]
  );
  return rows
    .map((h) => ({
      full_name: (h.profile_id ? nameOf.get(h.profile_id) : null) ?? h.full_name,
      hired_at: h.hired_at,
    }))
    .sort((a, b) => (b.hired_at ?? "").localeCompare(a.hired_at ?? ""));
}
