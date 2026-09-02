import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Inbox, ListChecks, Mail, Megaphone, Pencil, Sparkles, UserCheck, UserPlus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClientJob } from "@/lib/portal/jobs";
import {
  buildAudienceCatalogue,
  loadAudienceEligibility,
  loadAudiencePools,
  type AudienceEligibility,
} from "@/lib/admin/audience";
import { Alert, Badge, Button } from "@/components/ui";
import {
  addExternalApplication,
  deleteExternalApplication,
  removeJobCandidate,
  setJobOutcome,
  setJobSubmissionsClosed,
} from "@/app/(admin)/admin/actions";
import { SaveButton } from "@/components/patterns/save-button";
import { ConfirmActionButton } from "@/components/patterns/confirm-action-button";
import type { PortalClientOption } from "@/components/patterns/admin-job-row";
import { CandidatePicker } from "./candidate-picker";
import { JobDetailsForm, type JobDetailsData } from "./job-details-form";
import { JobQuestionsManager } from "./job-questions";
import { JobTabs, type JobTabDef } from "./job-tabs";
import { PublishPanel } from "./publish-panel";
import { ReviewCenter, type ReviewApplication } from "./review-center";
import { CandidateFinder, type FinderCandidate } from "./candidate-finder";
import { matchCandidates, studyInfoOf } from "@/lib/admin/candidate-match";
import { SendCandidatesButton } from "./send-candidates-button";

// Gemini rides a model-chain with retries — a stormy run outlives the platform
// default window. Server actions inherit the page segment they POST from.
export const maxDuration = 300;

export const metadata: Metadata = { title: "ניהול משרה" };

const cardClass = "bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm";

// The recruitment-pipeline pill in the header — display-only (the status is
// changed from the details tab / review center).
const PIPELINE: Record<
  string,
  { label: string; variant: "tech" | "mint" | "indigo" | "warm" | "grad" | "pink" }
> = {
  draft: { label: "לא פורסם", variant: "tech" },
  published: { label: "פורסם", variant: "mint" },
  candidates_sent: { label: "נשלחו מועמדות", variant: "indigo" },
  interviews: { label: "ראיונות", variant: "warm" },
  hired: { label: "גויס", variant: "grad" },
  closed_no_hire: { label: "נסגר ללא גיוס", variant: "pink" },
};

/**
 * applications.answers is jsonb {question_id: answer, fit: "..."} — answers
 * can be strings (paragraph/select), numbers (number) or string[] (multiselect).
 */
function parseAnswers(value: unknown): Record<string, string | number | string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string | number | string[]> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (Array.isArray(v)) {
      const list = v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
      if (list.length) out[k] = list;
    }
  }
  return out;
}

export default async function AdminJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  // This page reads employer-portal data via the service role, so gate it
  // explicitly beyond the (admin) layout.
  await requireRole("admin");
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select(
      "id, title, company, client_id, source, employment_type, location, tech_tags, external_url, description_html, status, job_kind, practicum_percent, pipeline_status, published_at, team_note, role_category"
    )
    .eq("id", id)
    .maybeSingle();
  if (!job) notFound();

  const [
    { data: applications },
    { data: curated },
    { data: members },
    { data: questions },
    { count: targetsCount },
    { data: clientRows },
    audienceCatalogue,
    audienceEligibility,
  ] = await Promise.all([
      admin
        .from("applications")
        .select("id, applicant_id, submitted_at, status, admin_mark, admin_mark_reason, answers, cv_document_id, sent_to_client_at, edited_at, previous_versions")
        .eq("job_id", id)
        .order("submitted_at", { ascending: false }),
      admin
        .from("job_candidates")
        .select("profile_id, created_at, interview_marked, client_note, sent_at")
        .eq("job_id", id)
        .order("created_at", { ascending: false }),
      admin
        .from("profiles")
        .select("id, full_name, specialization, region, is_experienced")
        .in("status", ["active", "pending"])
        .eq("role", "junior")
        .eq("profile_completed", true)
        .order("full_name", { ascending: true }),
      admin
        .from("job_questions")
        .select("id, question, answer_type, options, required, sort_order")
        .eq("job_id", id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      admin
        .from("job_targets")
        .select("profile_id", { count: "exact", head: true })
        .eq("job_id", id),
      // Portal clients the edit form can link the job to.
      admin
        .from("portal_clients")
        .select("id, company_name")
        .eq("is_active", true)
        .order("company_name", { ascending: true }),
      // The publish panel's criteria palette — only "ours" jobs render it.
      job.source === "ours" ? buildAudienceCatalogue() : Promise.resolve([]),
      // …and why the pool is the size it is, so the panel can say it out loud.
      job.source === "ours"
        ? loadAudienceEligibility()
        : Promise.resolve<AudienceEligibility | null>(null),
    ]);

  const clientOptions: PortalClientOption[] = (clientRows ?? []).map((c) => ({
    id: c.id,
    company_name: c.company_name,
  }));

  // job_questions.options is jsonb — coerce to a clean string[] for the UI.
  const questionItems = (questions ?? []).map((q) => ({
    id: q.id,
    question: q.question,
    sort_order: q.sort_order,
    answer_type: q.answer_type ?? "paragraph",
    options: Array.isArray(q.options)
      ? q.options.filter((o): o is string => typeof o === "string")
      : [],
    required: q.required !== false,
  }));

  const client = job.client_id
    ? (
        await admin
          .from("portal_clients")
          .select("id, company_name")
          .eq("id", job.client_id)
          .maybeSingle()
      ).data
    : null;

  // Who PASSES the privacy gate (includeUnsent — this is the admin preview).
  // A curated candidate outside it — opted out, paused, no longer a listed
  // junior — will be hidden from the client, so flag it here. Separately,
  // sent_at tells whether she was actually submitted yet: the client sees only
  // gate-passing AND sent candidates.
  const visibleToClient = job.client_id
    ? new Set(
        (await loadClientJob(job.client_id, id, { includeUnsent: true }))?.candidates.map(
          (c) => c.id
        ) ?? []
      )
    : null;
  const sentAtOf = new Map((curated ?? []).map((c) => [c.profile_id, c.sent_at ?? null]));

  // Names for applicants + curated candidates — they may not all be in the
  // active-junior list above (e.g. paused members).
  const appList = applications ?? [];
  const hiredCount = appList.filter((a) => a.status === "hired").length;
  const applicantIds = [...new Set(appList.map((a) => a.applicant_id))];
  const curatedIds = [...new Set((curated ?? []).map((c) => c.profile_id))];
  const needIds = [...new Set([...applicantIds, ...curatedIds])];
  const { data: named } = needIds.length
    ? await admin
        .from("profiles")
        .select("id, full_name, specialization, region, is_experienced, status, member_tier, role")
        .in("id", needIds)
    : {
        data: [] as {
          id: string;
          full_name: string;
          specialization: string | null;
          region: string | null;
          is_experienced: boolean;
          status: string;
          member_tier: string;
          role: string;
        }[],
      };
  const profileOf = new Map((named ?? []).map((p) => [p.id, p]));
  const curatedSet = new Set(curatedIds);

  // Off-community applications recorded by email — claimed automatically the
  // moment the woman signs in with that address (the owner, 31/8).
  const { data: externalApps } = await admin
    .from("external_applications")
    .select("id, email, note, created_at, claimed_at, claimed_profile_id")
    .eq("job_id", id)
    .order("created_at", { ascending: false });

  // The per-application internal notes (admin-only table) — the "הערה" column.
  const appIds = appList.map((a) => a.id);
  const { data: noteRows } = appIds.length
    ? await admin.from("application_notes").select("application_id, note").in("application_id", appIds)
    : { data: [] as { application_id: string; note: string | null }[] };
  const noteOf = new Map((noteRows ?? []).map((n) => [n.application_id, n.note]));

  // VIP flags from the admin-only member_crm table — an internal triage aid
  // that stays on this admin surface, never in the portal or member views.
  const { data: crmRows } = applicantIds.length
    ? await admin
        .from("member_crm")
        .select("profile_id, is_vip, internal_notes, internal_tags")
        .in("profile_id", applicantIds)
    : {
        data: [] as {
          profile_id: string;
          is_vip: boolean;
          internal_notes: string | null;
          internal_tags: string[] | null;
        }[],
      };
  // Internal profile tags (the owner, 2/9) — admin-only, never member/client.
  const crmTagsOf = new Map(
    (crmRows ?? []).map((c) => [c.profile_id, (c as { internal_tags?: string[] | null }).internal_tags ?? []])
  );
  const vipSet = new Set(
    (crmRows ?? []).filter((c) => c.is_vip === true).map((c) => c.profile_id)
  );
  // The team's general note about a member (from her page) follows her into
  // every application she submits — Shira's "ישתקף עליה במסך הגשות".
  const crmNoteOf = new Map(
    (crmRows ?? []).flatMap((c) =>
      c.internal_notes?.trim() ? [[c.profile_id, c.internal_notes] as const] : []
    )
  );

  // The review center's criteria engine, scoped to THE APPLICANTS (no
  // eligibility gates — a paused member who applied still counts): the
  // catalogue offers only values actually seen among them (no dead chips) and
  // the pools feed the client-side matching, label-resolved + lowercased.
  const [applicantCatalogue, applicantPoolData] = applicantIds.length
    ? await Promise.all([buildAudienceCatalogue(applicantIds), loadAudiencePools(applicantIds)])
    : [[], null];
  const applicantPools: Record<string, Record<string, string[]>> = {};
  for (const [pid, mine] of applicantPoolData?.pools ?? []) {
    applicantPools[pid] = Object.fromEntries(mine);
  }

  // The client's portal feedback per curated candidate (interview mark + note).
  const feedbackOf = new Map(
    (curated ?? []).map((c) => [
      c.profile_id,
      { interviewMarked: c.interview_marked === true, clientNote: c.client_note ?? null },
    ])
  );

  // CV per application: the CV she attached to THIS application, else her
  // latest upload — resolved to short-lived signed URLs like the portal route.
  const cvDocIds = [...new Set(appList.map((a) => a.cv_document_id).filter((v): v is string => !!v))];
  const { data: attachedDocs } = cvDocIds.length
    ? await admin.from("cv_documents").select("id, profile_id, file_path").in("id", cvDocIds)
    : { data: [] as { id: string; profile_id: string; file_path: string }[] };
  const attachedOf = new Map((attachedDocs ?? []).map((d) => [d.id, d]));

  const needLatestIds = [
    ...new Set(
      appList
        .filter((a) => {
          const doc = a.cv_document_id ? attachedOf.get(a.cv_document_id) : null;
          // Ownership re-check: an application row must never reach a document
          // that belongs to someone else.
          return !doc || doc.profile_id !== a.applicant_id;
        })
        .map((a) => a.applicant_id)
    ),
  ];
  const { data: latestDocs } = needLatestIds.length
    ? await admin
        .from("cv_documents")
        .select("profile_id, file_path, created_at")
        .in("profile_id", needLatestIds)
        .order("created_at", { ascending: false })
    : { data: [] as { profile_id: string; file_path: string; created_at: string }[] };
  const latestOf = new Map<string, string>();
  for (const d of latestDocs ?? []) {
    if (!latestOf.has(d.profile_id)) latestOf.set(d.profile_id, d.file_path); // newest-first
  }

  const cvPathOf = new Map<string, string>(); // application id → storage path
  for (const a of appList) {
    const doc = a.cv_document_id ? attachedOf.get(a.cv_document_id) : null;
    const path =
      doc && doc.profile_id === a.applicant_id ? doc.file_path : latestOf.get(a.applicant_id);
    if (path) cvPathOf.set(a.id, path);
  }
  const cvPaths = [...new Set(cvPathOf.values())];
  const { data: cvSigned } = cvPaths.length
    ? await admin.storage.from("cvs").createSignedUrls(cvPaths, 3600)
    : { data: [] };
  const cvUrlOf = new Map((cvSigned ?? []).map((s) => [s.path, s.signedUrl]));

  // Study facts + years for the review pane (the owner, 2/9: "בצורה בולטת").
  const reviewStudy = await studyInfoOf(applicantIds);
  const reviewApplications: ReviewApplication[] = appList.map((a) => {
    const p = profileOf.get(a.applicant_id);
    const study = reviewStudy.get(a.applicant_id);
    const path = cvPathOf.get(a.id);
    return {
      id: a.id,
      applicantId: a.applicant_id,
      submittedAt: a.submitted_at,
      status: a.status,
      adminMark: a.admin_mark ?? null,
      adminMarkReason: a.admin_mark_reason ?? null,
      sentToClientAt: a.sent_to_client_at ?? null,
      answers: parseAnswers(a.answers),
      cvUrl: path ? (cvUrlOf.get(path) ?? null) : null,
      profile: p
        ? {
            fullName: p.full_name,
            specialization: p.specialization,
            region: p.region,
            isExperienced: p.is_experienced === true,
            years: study?.years ?? null,
            studyPlace: study?.studyPlace ?? null,
            track: study?.track ?? null,
            gradYear: study?.gradYear ?? null,
          }
        : null,
      curated: curatedSet.has(a.applicant_id),
      clientFeedback: feedbackOf.get(a.applicant_id) ?? null,
      // "מנויה" = a PAYING member. Staff and mentors get their own labels
      // instead (the owner, 31/8: "אנחנו צוות!") and stay out of the מנויות
      // counter.
      isSubscriber: p?.status === "active" && p.member_tier === "paid" && p.role === "junior",
      memberLabel: p?.role === "admin" ? ("team" as const) : p?.role === "mentor" ? ("mentor" as const) : null,
      isVip: vipSet.has(a.applicant_id),
      memberTags: crmTagsOf.get(a.applicant_id) ?? [],
      editedAt: a.edited_at ?? null,
      previousVersions: (Array.isArray(a.previous_versions) ? a.previous_versions : []).map(
        (v) => {
          const pv = v as { saved_at?: string; answers?: unknown; cv_document_id?: string | null };
          return {
            savedAt: pv.saved_at ?? "",
            answers: parseAnswers(pv.answers),
            cvChanged: (pv.cv_document_id ?? null) !== (a.cv_document_id ?? null),
          };
        }
      ),
      crmNote: crmNoteOf.get(a.applicant_id) ?? null,
      adminNote: noteOf.get(a.id) ?? null,
    };
  });

  const jobDetails: JobDetailsData = {
    id: job.id,
    company: job.company,
    title: job.title,
    source: job.source,
    employment_type: job.employment_type,
    location: job.location,
    tech_tags: Array.isArray(job.tech_tags) ? job.tech_tags : [],
    external_url: job.external_url,
    description_html: job.description_html ?? null,
    client_id: job.client_id,
    job_kind: job.job_kind ?? "immediate",
    practicum_percent: job.practicum_percent ?? null,
    role_category: job.role_category ?? null,
  };

  const pipelinePill = PIPELINE[job.pipeline_status] ?? PIPELINE.draft;

  // ------------------------------------------------------------------- tabs
  // Two different lists on purpose: "מועמדות" counts APPLICATIONS, "לקוח"
  // counts what the client actually sees (curated) — the labels say so.
  const tabs: JobTabDef[] = [
    { key: "details", label: "פרטי המשרה" },
    ...(job.source === "ours" ? [{ key: "publish", label: "פרסום" }] : []),
    { key: "questions", label: "שאלות", count: questionItems.length },
    { key: "review", label: "מועמדות", count: appList.length },
    ...(job.source === "ours" ? [{ key: "finder", label: "איתור מתאימות" }] : []),
    { key: "client", label: "לקוח", count: curatedIds.length },
  ];

  // Candidates the client flagged for an interview — front-page news.
  const interviewMarkedNames = (curated ?? [])
    .filter((c) => c.interview_marked === true)
    .map((c) => profileOf.get(c.profile_id)?.full_name)
    .filter((n): n is string => !!n);
  // Default: straight into the review center when there's anything to review.
  const fallbackTab = appList.length > 0 ? "review" : "details";
  const initialTab = tabs.some((t) => t.key === tab) ? tab! : fallbackTab;

  const detailsPanel = (
    <div className={cardClass}>
      <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
        <Pencil size={16} className="text-brand-purple" /> פרטי המשרה
      </h3>
      <div className="mb-3">
        {client ? (
          <p className="text-[13px] text-ink-700">
            מקושרת ללקוח:{" "}
            <span className="font-semibold text-ink-900">{client.company_name}</span>
          </p>
        ) : (
          <Alert variant="warn">לא מקושרת ללקוח — בחרי לקוח בטופס שלמטה.</Alert>
        )}
      </div>
      {/* The form seeds source/kind/client into useState once. A re-render that
          keeps the instance mounted (a ?tab= navigation, a revalidate after a
          save) would leave those showing stale local state — and "משרה שלנו"
          is the select's first option, i.e. what it falls back to. Keying on
          the persisted values re-seeds them from the server. */}
      <JobDetailsForm
        key={`${job.id}:${job.source}:${job.job_kind ?? "immediate"}:${job.client_id ?? ""}`}
        job={jobDetails}
        clients={clientOptions}
      />

      {/* Job outcome — hired can be several members, so closing is always
          the admin's call; only "interviews" moves automatically. */}
      {job.source === "ours" && (
        <div className="mt-4 pt-3 border-t border-ink-100 flex items-center gap-2 flex-wrap">
          {job.pipeline_status === "hired" || job.pipeline_status === "closed_no_hire" ? (
            <>
              <Badge variant={job.pipeline_status === "hired" ? "grad" : "pink"}>
                {job.pipeline_status === "hired" ? "המשרה גויסה 🎉" : "נסגרה ללא גיוס"}
              </Badge>
              <ConfirmActionButton
                action={setJobOutcome.bind(null, job.id, "reopen")}
                message="להחזיר את המשרה לפעילה? היא תחזור להיות גלויה לקהל שלה."
                className="text-[12.5px] font-semibold text-brand-purple hover:text-brand-pink-deep"
              >
                החזרה לפעילה
              </ConfirmActionButton>
            </>
          ) : (
            <>
              {job.pipeline_status === "published" && (
                <ConfirmActionButton
                  action={setJobSubmissionsClosed.bind(null, job.id, true)}
                  message="לסגור את המשרה להגשות חדשות? היא תישאר פתוחה אצלך, החברות יראו שהיא התקדמה לשלב הבא ולא יוכלו להגיש עוד."
                  className="inline-flex items-center rounded-full border border-ink-300 text-ink-700 text-[12.5px] font-semibold px-3.5 py-1.5 hover:border-brand-purple hover:text-brand-purple transition-colors"
                >
                  סגירה להגשות — המועמדות אצל המעסיק
                </ConfirmActionButton>
              )}
              {(job.pipeline_status === "candidates_sent" || job.pipeline_status === "interviews") && (
                <ConfirmActionButton
                  action={setJobSubmissionsClosed.bind(null, job.id, false)}
                  message="לפתוח את המשרה מחדש להגשות? החברות בקהל היעד יוכלו שוב להגיש מועמדות."
                  className="text-[12.5px] font-semibold text-brand-purple hover:text-brand-pink-deep"
                >
                  פתיחה מחדש להגשות
                </ConfirmActionButton>
              )}
              {hiredCount > 0 && (
                <span className="text-[12.5px] text-ink-700">
                  🎉 {hiredCount === 1 ? "מועמדת אחת גויסה" : `${hiredCount} מועמדות גויסו`} —
                  כשסיימת לגייס, סגרי את המשרה:
                </span>
              )}
              <ConfirmActionButton
                action={setJobOutcome.bind(null, job.id, "hired")}
                message="לסמן את המשרה כגויסה? היא תרד מהלוח ותסומן 'גויס' אצל הלקוח."
                className="inline-flex items-center rounded-full bg-brand-gradient text-white text-[12.5px] font-semibold px-3.5 py-1.5 hover:brightness-105 transition-[filter]"
              >
                סימון המשרה כגויסה 🎉
              </ConfirmActionButton>
              <ConfirmActionButton
                action={setJobOutcome.bind(null, job.id, "closed_no_hire")}
                message="לסגור את המשרה ללא גיוס? היא תרד מהלוח."
                className="inline-flex items-center rounded-full border border-ink-300 text-ink-700 text-[12.5px] font-semibold px-3.5 py-1.5 hover:border-danger hover:text-danger transition-colors"
              >
                סגירה ללא גיוס
              </ConfirmActionButton>
            </>
          )}
        </div>
      )}
    </div>
  );

  // Targeted publishing — our jobs only (market jobs are applied to off-site)
  const publishPanel =
    job.source === "ours" ? (
      <div
        className={
          job.pipeline_status === "draft"
            ? `${cardClass} border-[1.5px] border-brand-pink shadow-glow-pink`
            : cardClass
        }
      >
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
          <Megaphone size={16} className="text-brand-pink-deep" /> פרסום המשרה
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          {job.pipeline_status === "draft"
            ? "המשרה עדיין טיוטה — בחרי את קהל היעד ופרסמי אותה. רק החברות שנבחרו יראו אותה ויקבלו מייל."
            : "המשרה פורסמה לקהל היעד שנבחר."}
        </p>
        <PublishPanel
          jobId={job.id}
          catalogue={audienceCatalogue}
          eligibility={audienceEligibility}
          allMembers={members ?? []}
          published={
            job.pipeline_status === "draft"
              ? null
              : { at: job.published_at, audienceCount: targetsCount ?? 0 }
          }
        />
      </div>
    ) : null;

  // The candidate finder (the owner, 2/9): everyone — applicants AND the
  // whole community — scored by PRACTICAL tech only (never "שלמדת"),
  // triaged in a table or one-by-one cards, with an optional AI pass.
  let finderPanel: React.ReactNode = null;
  if (job.source === "ours") {
    const communityRows = members ?? [];
    const finderIds = [...new Set([...communityRows.map((m) => m.id), ...applicantIds])];
    const [matches, studyInfo, { data: reviewRows }] = await Promise.all([
      matchCandidates(job.tech_tags ?? [], finderIds),
      studyInfoOf(finderIds),
      admin
        .from("job_candidate_reviews")
        .select("profile_id, status, ai_score, ai_reason")
        .eq("job_id", id),
    ]);
    const reviewOf = new Map((reviewRows ?? []).map((r) => [r.profile_id, r]));
    const appOf = new Map(appList.map((a) => [a.applicant_id, a]));
    const communityInfo = new Map(communityRows.map((m) => [m.id, m]));
    const finderCandidates: FinderCandidate[] = finderIds.map((pid) => {
      const m = matches.get(pid);
      const rv = reviewOf.get(pid);
      const app = appOf.get(pid);
      const base = communityInfo.get(pid) ?? profileOf.get(pid);
      const ansObj = (app?.answers ?? {}) as Record<string, string>;
      const study = studyInfo.get(pid);
      return {
        profileId: pid,
        name: base?.full_name ?? "חברת קהילה",
        specialization: base?.specialization ?? null,
        region: (base as { region?: string | null } | undefined)?.region ?? null,
        experienced: (base as { is_experienced?: boolean | null } | undefined)?.is_experienced === true,
        studyPlace: study?.studyPlace ?? null,
        track: study?.track ?? null,
        gradYear: study?.gradYear ?? null,
        years: m?.years ?? null,
        score: m?.score ?? 0,
        matched: m?.matched ?? [],
        missing: m?.missing ?? [],
        extra: m?.extra ?? [],
        applied: !!app,
        appliedAnswers: app
          ? questionItems
              .map((qi) => ({ q: qi.question, a: String(ansObj[qi.id] ?? "") }))
              .filter((qa) => qa.a)
          : [],
        status: (rv?.status ?? "new") as "new" | "fit" | "maybe" | "no",
        aiScore: rv?.ai_score ?? null,
        aiReason: rv?.ai_reason ?? null,
      };
    });
    finderPanel = (
      <div className={cardClass}>
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
          <Sparkles size={16} className="text-brand-pink-deep" /> איתור המתאימות ביותר
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          ציון ההתאמה נבנה מטכנולוגיות מניסיון <b>מעשי</b> בלבד — עבודות, פרקטיקום — לא ממה
          שנלמד בקורסים. הסימונים (מתאימה/אולי/לא) נשמרים פר משרה, פנימיים בלבד.
        </p>
        <CandidateFinder jobId={job.id} candidates={finderCandidates} appliedCount={applicantIds.length} />
      </div>
    );
  }

  // Application questions (required or optional)
  const questionsPanel = (
    <div className={cardClass}>
      <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
        <ListChecks size={16} className="text-brand-purple" /> שאלות למועמדות
      </h3>
      <p className="text-[12.5px] text-ink-500 mb-3">
        שאלות שכל מועמדת רואה בהגשה למשרה הזו — כל שאלה אפשר לסמן כחובה או רשות. שימי לב: השאלה
        {" “למה את חושבת שאת מתאימה למשרה?” "}
        נשאלת תמיד אוטומטית — אין צורך להוסיף אותה.
      </p>
      <JobQuestionsManager jobId={job.id} questions={questionItems} />
    </div>
  );

  // Review center — the applicants who submitted to this job
  const reviewPanel = (
    <div className={cardClass}>
      <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
        <Inbox size={16} className="text-brand-pink-deep" /> מועמדות שהגישו ({appList.length})
      </h3>
      <p className="text-[12.5px] text-ink-500 mb-3">
        מרכז הבדיקה: תשובות, קורות חיים, סימון פנימי וניהול הצינור מול הלקוח.
        הסימונים פנימיים בלבד — לא נחשפים ללקוח ולא למועמדת.
      </p>
      <ReviewCenter
        jobId={job.id}
        jobTitle={job.title}
        teamNote={job.team_note ?? null}
        applications={reviewApplications}
        questions={questionItems.map((q) => ({ id: q.id, question: q.question }))}
        criteriaCatalogue={applicantCatalogue}
        criteriaPools={applicantPools}
      />

      {/* Applications that happened OUTSIDE the community — recorded by email.
          When the woman signs in with that address, she gets a real
          application (original date) and this row turns "נקלטה". */}
      <div className="mt-5 border-t border-ink-100 pt-4">
        <h4 className="font-display text-[14px] font-bold mb-1 flex items-center gap-1.5">
          <Mail size={14} className="text-brand-purple" /> הגישו מחוץ לקהילה ({(externalApps ?? []).length})
        </h4>
        <p className="text-[12.5px] text-ink-500 mb-2.5">
          מועמדת שהגישה במייל לפני שנרשמה — רשמי את הכתובת, וברגע שתיכנס עם המייל הזה
          ההגשה תופיע לה ב&quot;ההגשות שלי&quot; עם תאריך ההגשה המקורי.
        </p>
        {(externalApps ?? []).length > 0 && (
          <div className="flex flex-col gap-1 mb-2.5">
            {(externalApps ?? []).map((x) => (
              <div key={x.id} className="flex items-center gap-2 text-[12.5px] bg-ink-50/60 border border-ink-100 rounded-md px-2.5 py-1.5">
                <span className="font-semibold text-ink-900" dir="ltr">{x.email}</span>
                {x.note && <span className="text-ink-500 truncate">· {x.note}</span>}
                <span className="ms-auto shrink-0">
                  {x.claimed_at ? (
                    <span className="inline-flex items-center rounded-full bg-tint-mint text-[#0F6E4A] px-2 py-px text-[11px] font-bold">
                      ✓ נקלטה {profileOf.get(x.claimed_profile_id ?? "")?.full_name ?? ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-tint-purple text-brand-purple px-2 py-px text-[11px] font-bold">
                      ממתינה להצטרפות
                    </span>
                  )}
                </span>
                {!x.claimed_at && (
                  <form action={deleteExternalApplication.bind(null, job.id, x.id)}>
                    <button type="submit" className="text-ink-400 hover:text-danger cursor-pointer" title="הסרה">
                      ✕
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
        <form action={addExternalApplication.bind(null, job.id)} className="flex flex-wrap items-center gap-2">
          <input
            name="email"
            type="email"
            required
            dir="ltr"
            placeholder="email@example.com"
            className="w-56 text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
          />
          <input
            name="note"
            maxLength={200}
            placeholder="הערה (אופציונלי — למשל: הגישה במייל 28/8)"
            className="flex-1 min-w-[180px] text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
          />
          <SaveButton label="הוספה" />
        </form>
      </div>
    </div>
  );

  const clientPanel = (
    <div className="flex flex-col gap-5">
      {/* Curated */}
      <div className={cardClass}>
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
          <UserCheck size={16} className="text-brand-purple" /> המועמדות שנבחרו למשרה ({curated?.length ?? 0})
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          אלו המועמדות שהלקוח רואה בפורטל — הרשימה הזו נבחרת על ידך (מהמגישות או
          ידנית), והיא נפרדת מרשימת ההגשות בטאב &quot;מועמדות&quot;.
        </p>
        {curated && curated.length > 0 ? (
          <div className="flex flex-col">
            {curated.map((c) => {
              const p = profileOf.get(c.profile_id);
              const hidden = visibleToClient !== null && !visibleToClient.has(c.profile_id);
              return (
                <div
                  key={c.profile_id}
                  className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap"
                >
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-medium text-ink-900">{p?.full_name ?? "מועמדת"}</div>
                    <div className="text-xs text-ink-500">{p?.specialization ?? "—"}</div>
                  </div>
                  {c.interview_marked === true && (
                    <Badge variant="warm">הלקוח מסמן לראיון ⭐</Badge>
                  )}
                  {hidden ? (
                    <Badge variant="warm" title="לא עומדת בתנאי התצוגה בפורטל (למשל ביקשה לא להופיע, או אינה פעילה) — הלקוח לא יראה אותה ולא תישלח במייל.">
                      לא מוצגת ללקוח
                    </Badge>
                  ) : sentAtOf.get(c.profile_id) ? (
                    <Badge variant="mint" title="נשלחה ללקוח — מופיעה אצלו בפורטל.">
                      נשלחה ללקוח ✓
                    </Badge>
                  ) : (
                    <Badge variant="tech" title="נבחרה למשרה אך טרם הוגשה — הלקוח יראה אותה רק אחרי 'שליחה ללקוח'.">
                      טרם נשלחה
                    </Badge>
                  )}
                  <form action={removeJobCandidate.bind(null, job.id, c.profile_id)}>
                    <Button type="submit" size="sm" variant="ghost">
                      הסרה
                    </Button>
                  </form>
                  {c.client_note && (
                    <p className="w-full basis-full text-[12.5px] text-ink-700 bg-tint-purple rounded-md px-3 py-2 mt-1">
                      <b>הערת הלקוח:</b> {c.client_note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm py-2">עדיין לא נבחרו מועמדות למשרה הזו.</p>
        )}
      </div>

      {/* Add anyone */}
      <div className={cardClass}>
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
          <UserPlus size={16} className="text-brand-pink-deep" /> הוספת מועמדת נוספת
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          חיפוש בכל חברות הקהילה הפעילות והוספה ישירה למשרה.
        </p>
        <CandidatePicker jobId={job.id} members={members ?? []} addedIds={curatedIds} />
      </div>

      {/* Send to client */}
      <div className={cardClass}>
        <h3 className="font-display text-base font-bold mb-1 flex items-center gap-1.5">
          <Mail size={16} className="text-brand-purple" /> שליחה ללקוח
        </h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          המייל שולח ללקוח קישור לצפייה במועמדות שנבחרו, ישירות בעמוד המשרה בפורטל.
          מועמדות שסימנת {"“אישור סופי”"} במרכז הבדיקה מצטרפות לרשימה אוטומטית בשליחה.
        </p>
        <SendCandidatesButton jobId={job.id} clientName={client?.company_name ?? null} />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-purple hover:underline self-start"
      >
        <ArrowRight size={15} /> חזרה לניהול משרות
      </Link>

      {/* Header */}
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;משרה/&gt;</span>
            <h1 className="font-display text-[24px] font-black text-ink-1000 mt-1">{job.title}</h1>
            <p className="text-[13px] text-ink-500 mt-1">{job.company}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {job.source === "ours" && (
              <Badge variant={pipelinePill.variant}>{pipelinePill.label}</Badge>
            )}
            <Badge variant={job.source === "ours" ? "pink" : "tech"}>
              {job.source === "ours" ? "משרה שלנו" : "משרה מהשוק"}
            </Badge>
          </div>
        </div>
      </div>

      {interviewMarkedNames.length > 0 && (
        <Alert variant="success" title="🎯 הלקוח מסמן לראיון">
          {interviewMarkedNames.join(", ")} — עדכני את המועמדת וקבעי סטטוס ראיון בטאב
          המועמדות.
        </Alert>
      )}

      <JobTabs
        tabs={tabs}
        initialTab={initialTab}
        panels={{
          details: detailsPanel,
          publish: publishPanel,
          questions: questionsPanel,
          review: reviewPanel,
          finder: finderPanel,
          client: clientPanel,
        }}
      />
    </div>
  );
}
