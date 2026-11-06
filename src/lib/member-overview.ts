// The admin's view of ONE member's trail (the owner, 25/10): every job she
// applied to - with her answers, the team's mark, and whether she was sent to
// the employer in the end; the coordinator's opinion of her; and her hackathon
// submission with the links the judges use. Server-only (service role).
import { createAdminClient } from "@/lib/supabase/admin";
import { netfreeSafeUrl } from "@/lib/netfree";
import { teamKeyOf } from "@/lib/hackathon-submission";
import { totalOf, ZERO_SCORES, type AutoReport } from "@/lib/judging-shared";
import { CHALLENGES } from "@/app/hackathon-2026/shared";
import { withPrevSurnames } from "@/lib/prev-surname";
import type { ApplicationStatus } from "@/types/database";

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "טיוטה",
  submitted: "הוגשה",
  in_review: "בבדיקה",
  accepted: "אושרה",
  rejected: "נדחתה",
  sent: "הוגשה ללקוח",
  interview: "ראיון",
  exam: "מבחן",
  hired: "גויסה 🎉",
  declined: "בפעם הבאה",
  waitlisted: "התקדמנו בינתיים",
};
export const ADMIN_MARK_LABEL: Record<string, string> = { optional: "אופציונלית", not_fit: "לא מתאימה", approved: "אישור סופי" };
export const FIT_QUESTION = "למה את חושבת שאת מתאימה למשרה?";

export interface MemberApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  jobStatus: string;
  submittedAt: string;
  status: ApplicationStatus;
  adminMark: string | null;
  adminMarkReason: string | null;
  /** When she was passed on to the employer - the application's stamp, or the candidate row's. */
  sentToClientAt: string | null;
  interviewMarked: boolean;
  clientNote: string | null;
  /** The team's note on HER × THIS job (application_notes). */
  note: string | null;
  answers: { label: string; answer: string }[];
  editedAt: string | null;
}

function answerText(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(" · ");
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Every application of hers, newest first, with the answers resolved to the questions' words. */
export async function loadMemberApplications(profileId: string): Promise<MemberApplication[]> {
  const admin = createAdminClient();
  const { data: apps } = await admin
    .from("applications")
    .select("id, job_id, status, note, submitted_at, answers, admin_mark, admin_mark_reason, sent_to_client_at, edited_at")
    .eq("applicant_id", profileId)
    .order("submitted_at", { ascending: false })
    .limit(500);
  if (!apps?.length) return [];
  const jobIds = [...new Set(apps.map((a) => a.job_id))];
  const [{ data: jobs }, { data: candidates }, { data: questions }, { data: notes }] = await Promise.all([
    admin.from("jobs").select("id, title, company, status").in("id", jobIds),
    admin.from("job_candidates").select("job_id, sent_at, interview_marked, client_note").eq("profile_id", profileId).in("job_id", jobIds),
    admin.from("job_questions").select("id, job_id, question, sort_order").in("job_id", jobIds).order("sort_order", { ascending: true }),
    admin.from("application_notes").select("application_id, note").in("application_id", apps.map((a) => a.id)),
  ]);
  const jobOf = new Map((jobs ?? []).map((j) => [j.id, j]));
  const candOf = new Map((candidates ?? []).map((c) => [c.job_id, c]));
  const noteOf = new Map((notes ?? []).map((n) => [n.application_id, n.note]));
  const questionsOf = new Map<string, { id: string; question: string }[]>();
  for (const q of questions ?? []) questionsOf.set(q.job_id, [...(questionsOf.get(q.job_id) ?? []), { id: q.id, question: q.question }]);
  return apps.map((a) => {
    const job = jobOf.get(a.job_id);
    const cand = candOf.get(a.job_id);
    const raw = (a.answers && typeof a.answers === "object" && !Array.isArray(a.answers) ? (a.answers as Record<string, unknown>) : {}) as Record<string, unknown>;
    const answers: { label: string; answer: string }[] = [];
    if (raw.fit !== undefined && answerText(raw.fit)) answers.push({ label: FIT_QUESTION, answer: answerText(raw.fit) });
    const known = new Set(["fit"]);
    for (const q of questionsOf.get(a.job_id) ?? []) {
      known.add(q.id);
      if (raw[q.id] !== undefined && answerText(raw[q.id])) answers.push({ label: q.question, answer: answerText(raw[q.id]) });
    }
    for (const [k, v] of Object.entries(raw)) if (!known.has(k) && answerText(v)) answers.push({ label: k, answer: answerText(v) });
    return {
      id: a.id,
      jobId: a.job_id,
      jobTitle: job?.title ?? "משרה",
      company: job?.company ?? "",
      jobStatus: job?.status ?? "",
      submittedAt: a.submitted_at,
      status: a.status,
      adminMark: a.admin_mark,
      adminMarkReason: a.admin_mark_reason,
      sentToClientAt: a.sent_to_client_at ?? cand?.sent_at ?? null,
      interviewMarked: !!cand?.interview_marked,
      clientNote: cand?.client_note ?? null,
      note: noteOf.get(a.id) ?? a.note ?? null,
      answers,
      editedAt: a.edited_at,
    };
  });
}

export interface MemberCoordinatorReview {
  id: string;
  coordinator: string;
  institutionNote: string | null;
  communication: number | null;
  communicationLabel: string | null;
  talent: number | null;
  talentLabel: string | null;
  note: string | null;
  foundJob: boolean | null;
  foundJobPlace: string | null;
  updatedAt: string;
}

/** What her coordinator(s) wrote about her - every review linked to her profile. */
export async function loadMemberCoordinatorReviews(profileId: string): Promise<MemberCoordinatorReview[]> {
  const admin = createAdminClient();
  const { data: reviews } = await admin
    .from("coordinator_reviews")
    .select("id, contact_id, communication, talent, note, talent_label, communication_label, found_job, found_job_place, updated_at")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false });
  if (!reviews?.length) return [];
  const contactIds = [...new Set(reviews.map((r) => r.contact_id))];
  const { data: contacts } = await admin.from("institution_contacts").select("id, full_name, notes").in("id", contactIds);
  const contactOf = new Map((contacts ?? []).map((c) => [c.id, c]));
  return reviews.map((r) => ({
    id: r.id,
    coordinator: contactOf.get(r.contact_id)?.full_name ?? "רכזת",
    institutionNote: contactOf.get(r.contact_id)?.notes ?? null,
    communication: r.communication,
    communicationLabel: r.communication_label,
    talent: r.talent,
    talentLabel: r.talent_label,
    note: r.note,
    foundJob: r.found_job,
    foundJobPlace: r.found_job_place,
    updatedAt: r.updated_at,
  }));
}

export interface MemberHackathon {
  challengeKey: string;
  challengeShort: string;
  challengeEmoji: string;
  partnerName: string | null;
  partnerConfirmed: boolean;
  teamKey: string;
  submittedAt: string | null;
  productUrl: string | null;
  repoUrl: string | null;
  /** The video as the judges open it: the Drive copy, the pasted link, or the uploaded file through our domain. */
  videoUrl: string | null;
  videoKind: "drive" | "link" | "file" | null;
  autoTotal: number | null;
  autoCapped: boolean;
}

export interface MemberHackathonReview extends MemberHackathon {
  /** The automated review without its screenshots (megabytes per report) - null when it never ran, or when the viewer may not read it. */
  report: AutoReport | null;
  reportRanAt: string | null;
}

/** Her hackathon trail: the registration, the team, the submission's links, the automated score. */
export async function loadMemberHackathon(profileId: string): Promise<MemberHackathon | null> {
  return (await loadMembersHackathon([profileId])).get(profileId) ?? null;
}

/**
 * The same trail for many women at once - the review center shows it on top of
 * every application (the owner, 1/11: ״בהגשת משרה שים למעלה בצורה בולטת הגישה
 * להאקתון עם לינק לסרטון + אפשרות לפתוח בועה עם חוות הדעת המלאה של ה-AI
 * והציון״). One query per table instead of one per applicant. She reaches a
 * team by her own registration, or as the confirmed partner on someone else's.
 *
 * `withReport: false` = the viewer may not read the automated review (an
 * appointed judge the owner has not opened it to - judgeAccessFor): the report
 * AND the score it implies stay out.
 */
export async function loadMembersHackathon(profileIds: string[], opts?: { withReport?: boolean }): Promise<Map<string, MemberHackathonReview>> {
  const out = new Map<string, MemberHackathonReview>();
  const ids = [...new Set(profileIds)];
  if (ids.length === 0) return out;
  const admin = createAdminClient();
  const withReport = opts?.withReport !== false;
  const [{ data: own }, { data: asPartner }] = await Promise.all([
    admin.from("hackathon_registrations").select("profile_id, challenge_key, partner_profile_id, partner_confirmed_at").in("profile_id", ids),
    admin.from("hackathon_registrations").select("profile_id, challenge_key, partner_profile_id, partner_confirmed_at").in("partner_profile_id", ids).not("partner_confirmed_at", "is", null),
  ]);
  const regOf = new Map<string, { challengeKey: string; teamKey: string; partnerId: string | null; partnerConfirmed: boolean }>();
  for (const r of own ?? []) {
    regOf.set(r.profile_id, {
      challengeKey: r.challenge_key,
      teamKey: teamKeyOf(r.profile_id, r.partner_profile_id, !!r.partner_confirmed_at),
      partnerId: r.partner_profile_id,
      partnerConfirmed: !!r.partner_confirmed_at,
    });
  }
  for (const r of asPartner ?? []) {
    const me = r.partner_profile_id;
    if (!me || regOf.has(me)) continue;
    regOf.set(me, { challengeKey: r.challenge_key, teamKey: teamKeyOf(r.profile_id, me, true), partnerId: r.profile_id, partnerConfirmed: true });
  }
  if (regOf.size === 0) return out;
  const teamKeys = [...new Set([...regOf.values()].map((r) => r.teamKey))];
  const partnerIds = [...new Set([...regOf.values()].flatMap((r) => (r.partnerId ? [r.partnerId] : [])))];
  const [{ data: subs }, { data: reports }, { data: partnerRows }] = await Promise.all([
    admin.from("hackathon_submissions").select("team_key, product_url, repo_url, video_url, video_path, drive_file_id, submitted_at").in("team_key", teamKeys),
    withReport
      ? admin.from("hackathon_auto_reports").select("team_key, report, updated_at").in("team_key", teamKeys)
      : Promise.resolve({ data: [] as { team_key: string; report: unknown; updated_at: string }[] }),
    partnerIds.length
      ? admin.from("profiles").select("id, full_name").in("id", partnerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const partnerName = new Map((await withPrevSurnames(partnerRows ?? [])).map((p) => [p.id, p.full_name]));
  const subOf = new Map((subs ?? []).map((s) => [s.team_key, s]));
  const reportOf = new Map((reports ?? []).map((r) => [r.team_key, r]));
  // The uploaded files' signed links (1h) - one per team that has one.
  const signedOf = new Map<string, string | null>();
  await Promise.all(
    [...subOf.values()]
      .filter((s) => !s.drive_file_id && !s.video_url && s.video_path)
      .map(async (s) => {
        const { data: signed } = await admin.storage.from("hackathon").createSignedUrl(s.video_path!, 3600);
        signedOf.set(s.team_key, netfreeSafeUrl(signed?.signedUrl ?? null));
      })
  );
  for (const [profileId, reg] of regOf) {
    const challenge = CHALLENGES.find((c) => c.key === reg.challengeKey);
    const sub = subOf.get(reg.teamKey);
    let videoUrl: string | null = null;
    let videoKind: MemberHackathon["videoKind"] = null;
    if (sub?.drive_file_id) {
      videoUrl = `https://drive.google.com/file/d/${encodeURIComponent(sub.drive_file_id)}/view`;
      videoKind = "drive";
    } else if (sub?.video_url) {
      videoUrl = sub.video_url;
      videoKind = "link";
    } else if (sub?.video_path) {
      videoUrl = signedOf.get(reg.teamKey) ?? null;
      videoKind = videoUrl ? "file" : null;
    }
    const rep = reportOf.get(reg.teamKey);
    const report = slimReport(rep?.report);
    const auto = report?.suggested ? totalOf({ ...ZERO_SCORES, ...report.suggested }) : null;
    out.set(profileId, {
      challengeKey: reg.challengeKey,
      challengeShort: challenge?.short ?? reg.challengeKey,
      challengeEmoji: challenge?.emoji ?? "🏆",
      partnerName: reg.partnerId ? (partnerName.get(reg.partnerId) ?? null) : null,
      partnerConfirmed: reg.partnerConfirmed,
      teamKey: reg.teamKey,
      submittedAt: sub?.submitted_at ?? null,
      productUrl: sub?.product_url ?? null,
      repoUrl: sub?.repo_url ?? null,
      videoUrl,
      videoKind,
      autoTotal: auto?.total ?? null,
      autoCapped: auto?.capped ?? false,
      report,
      reportRanAt: rep?.updated_at ?? null,
    });
  }
  return out;
}

/** The report without its screenshots - data URIs of megabytes that no list page should carry. */
function slimReport(raw: unknown): AutoReport | null {
  if (!raw || typeof raw !== "object") return null;
  const { screenshots, ...rest } = raw as AutoReport;
  return { ...rest, hasScreenshot: !!screenshots?.length || !!rest.hasScreenshot };
}
