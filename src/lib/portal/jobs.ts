// A portal client's own jobs and the candidates an admin curated for each.
//
// Candidates always go through loadCandidates(), so the same privacy contract
// applies here: only listed, active, completed members with employer-visible
// fields — a member who opted out of the portal never appears, even if an
// admin added her to a job.
//
// SENT gate: curation is internal staging. A candidate reaches the client ONLY
// after the admin's explicit "הגשה ללקוח" (job_candidates.sent_at is stamped).
// Nothing may appear at the client that didn't pass through the admin flow.

import { createAdminClient } from "@/lib/supabase/admin";
import { loadCandidates } from "./candidates";
import type { CandidateDetail } from "./types";

export interface ClientJobFeedback {
  interviewMarked: boolean;
  clientNote: string | null;
}

export interface ClientJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  status: string;
  created_at: string;
  candidates: CandidateDetail[];
  /**
   * The client's own feedback per candidate id (interview mark + note). Both
   * loaders fill it, and only for candidates the client can actually see — a
   * hidden candidate's row must not leak even as a bare id.
   */
  feedback?: Record<string, ClientJobFeedback>;
}

/** All of this client's jobs, each with its curated candidate list. */
export async function loadClientJobs(clientId: string): Promise<ClientJob[]> {
  const admin = createAdminClient();
  const { data: jobs } = await admin
    .from("jobs")
    .select("id, title, company, location, status, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (!jobs?.length) return [];

  const { data: rows } = await admin
    .from("job_candidates")
    .select("job_id, profile_id, created_at, interview_marked, client_note")
    .in("job_id", jobs.map((j) => j.id))
    .not("sent_at", "is", null)
    .order("created_at", { ascending: true });

  const { candidates } = await loadCandidates();
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const byJob = new Map<string, CandidateDetail[]>();
  const feedbackByJob = new Map<string, Record<string, ClientJobFeedback>>();
  for (const r of rows ?? []) {
    const c = byId.get(r.profile_id);
    if (!c) continue; // not listed / opted out → never shown, feedback row included
    const arr = byJob.get(r.job_id) ?? [];
    arr.push(c);
    byJob.set(r.job_id, arr);

    const fb = feedbackByJob.get(r.job_id) ?? {};
    fb[r.profile_id] = {
      interviewMarked: r.interview_marked === true,
      clientNote: r.client_note ?? null,
    };
    feedbackByJob.set(r.job_id, fb);
  }

  return jobs.map((j) => ({
    ...j,
    candidates: byJob.get(j.id) ?? [],
    feedback: feedbackByJob.get(j.id) ?? {},
  }));
}

/** One client job on which a candidate was SENT, with the client's own feedback. */
export interface SentCandidateJob {
  jobId: string;
  jobTitle: string;
  interviewMarked: boolean;
  clientNote: string | null;
}

/**
 * The client's jobs on which we SENT this candidate — job_candidates rows on
 * the client's jobs with sent_at stamped — each with the client's own feedback
 * (interview mark + note), so the candidate page can offer the invite control
 * right where the client is reading. An empty array is the same privacy gate
 * candidateSentToClient enforces: never sent ⇒ nothing to show.
 */
export async function candidateSentJobs(
  clientId: string,
  profileId: string
): Promise<SentCandidateJob[]> {
  const admin = createAdminClient();
  const { data: jobs } = await admin.from("jobs").select("id, title").eq("client_id", clientId);
  if (!jobs?.length) return [];
  const titleOf = new Map(jobs.map((j) => [j.id, j.title]));

  const { data: rows } = await admin
    .from("job_candidates")
    .select("job_id, interview_marked, client_note, created_at")
    .eq("profile_id", profileId)
    .in("job_id", jobs.map((j) => j.id))
    .not("sent_at", "is", null)
    .order("created_at", { ascending: true });

  return (rows ?? []).map((r) => ({
    jobId: r.job_id,
    jobTitle: titleOf.get(r.job_id) ?? "",
    interviewMarked: r.interview_marked === true,
    clientNote: r.client_note ?? null,
  }));
}

/**
 * Whether we ever SENT this candidate to this client — a job_candidates row on
 * one of the client's jobs with sent_at stamped. This is the privacy gate for
 * clients without free search: any other candidate must look nonexistent.
 */
export async function candidateSentToClient(clientId: string, profileId: string): Promise<boolean> {
  const sent = await candidateSentJobs(clientId, profileId);
  return sent.length > 0;
}

/**
 * One job, only if it belongs to this client. null otherwise (404 upstream).
 * includeUnsent is for the ADMIN send flow only — it previews the not-yet-sent
 * curated list through the same privacy gate. Portal pages never pass it.
 */
export async function loadClientJob(
  clientId: string,
  jobId: string,
  opts?: { includeUnsent?: boolean }
): Promise<ClientJob | null> {
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select("id, title, company, location, status, created_at, client_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.client_id !== clientId) return null;

  let rowsQuery = admin
    .from("job_candidates")
    .select("profile_id, created_at, interview_marked, client_note")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (!opts?.includeUnsent) rowsQuery = rowsQuery.not("sent_at", "is", null);
  const { data: rows } = await rowsQuery;

  const { candidates } = await loadCandidates();
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const list = (rows ?? [])
    .map((r) => byId.get(r.profile_id))
    .filter((c): c is CandidateDetail => !!c);

  // Feedback only for candidates the client can see — a hidden candidate's row
  // must not leak even as a bare id.
  const shown = new Set(list.map((c) => c.id));
  const feedback: Record<string, ClientJobFeedback> = {};
  for (const r of rows ?? []) {
    if (!shown.has(r.profile_id)) continue;
    feedback[r.profile_id] = {
      interviewMarked: r.interview_marked === true,
      clientNote: r.client_note ?? null,
    };
  }

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    status: job.status,
    created_at: job.created_at,
    candidates: list,
    feedback,
  };
}
