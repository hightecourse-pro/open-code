// The admin's view of ONE member's trail (the owner, 25/10): every job she
// applied to - with her answers, the team's mark, and whether she was sent to
// the employer in the end; the coordinator's opinion of her; and her hackathon
// submission with the links the judges use. Server-only (service role).
import { createAdminClient } from "@/lib/supabase/admin";
import { netfreeSafeUrl } from "@/lib/netfree";
import { teamKeyOf } from "@/lib/hackathon-submission";
import { totalOf, ZERO_SCORES } from "@/lib/judging-shared";
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
const FIT_QUESTION = "למה את חושבת שאת מתאימה למשרה?";

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

/** Her hackathon trail: the registration, the team, the submission's links, the automated score. */
export async function loadMemberHackathon(profileId: string): Promise<MemberHackathon | null> {
  const admin = createAdminClient();
  const { data: reg } = await admin.from("hackathon_registrations").select("challenge_key, partner_profile_id, partner_confirmed_at").eq("profile_id", profileId).maybeSingle();
  if (!reg) return null;
  const teamKey = teamKeyOf(profileId, reg.partner_profile_id, !!reg.partner_confirmed_at);
  const [{ data: sub }, partner, { data: report }] = await Promise.all([
    admin.from("hackathon_submissions").select("team_key, product_url, repo_url, video_url, video_path, drive_file_id, submitted_at").eq("team_key", teamKey).maybeSingle(),
    reg.partner_profile_id ? admin.from("profiles").select("id, full_name").eq("id", reg.partner_profile_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("hackathon_auto_reports").select("report").eq("team_key", teamKey).maybeSingle(),
  ]);
  const challenge = CHALLENGES.find((c) => c.key === reg.challenge_key);
  let videoUrl: string | null = null;
  let videoKind: MemberHackathon["videoKind"] = null;
  if (sub?.drive_file_id) {
    videoUrl = `https://drive.google.com/file/d/${encodeURIComponent(sub.drive_file_id)}/view`;
    videoKind = "drive";
  } else if (sub?.video_url) {
    videoUrl = sub.video_url;
    videoKind = "link";
  } else if (sub?.video_path) {
    const { data: signed } = await admin.storage.from("hackathon").createSignedUrl(sub.video_path, 3600);
    videoUrl = netfreeSafeUrl(signed?.signedUrl ?? null);
    videoKind = videoUrl ? "file" : null;
  }
  const suggested = report?.report && typeof report.report === "object" ? (report.report as { suggested?: Record<string, number> }).suggested : undefined;
  const auto = suggested ? totalOf({ ...ZERO_SCORES, ...suggested }) : null;
  const partnerName = partner.data ? (await withPrevSurnames([partner.data]))[0]?.full_name ?? partner.data.full_name : null;
  return {
    challengeKey: reg.challenge_key,
    challengeShort: challenge?.short ?? reg.challenge_key,
    challengeEmoji: challenge?.emoji ?? "🏆",
    partnerName,
    partnerConfirmed: !!reg.partner_confirmed_at,
    teamKey,
    submittedAt: sub?.submitted_at ?? null,
    productUrl: sub?.product_url ?? null,
    repoUrl: sub?.repo_url ?? null,
    videoUrl,
    videoKind,
    autoTotal: auto?.total ?? null,
    autoCapped: auto?.capped ?? false,
  };
}
