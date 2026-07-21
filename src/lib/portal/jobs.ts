// A portal client's own jobs and the candidates an admin curated for each.
//
// Candidates always go through loadCandidates(), so the same privacy contract
// applies here: only listed, active, completed members with employer-visible
// fields — a member who opted out of the portal never appears, even if an
// admin added her to a job.

import { createAdminClient } from "@/lib/supabase/admin";
import { loadCandidates } from "./candidates";
import type { CandidateDetail } from "./types";

export interface ClientJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  status: string;
  created_at: string;
  candidates: CandidateDetail[];
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
    .select("job_id, profile_id, created_at")
    .in("job_id", jobs.map((j) => j.id))
    .order("created_at", { ascending: true });

  const { candidates } = await loadCandidates();
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const byJob = new Map<string, CandidateDetail[]>();
  for (const r of rows ?? []) {
    const c = byId.get(r.profile_id);
    if (!c) continue; // not listed / opted out → never shown
    const arr = byJob.get(r.job_id) ?? [];
    arr.push(c);
    byJob.set(r.job_id, arr);
  }

  return jobs.map((j) => ({ ...j, candidates: byJob.get(j.id) ?? [] }));
}

/** One job, only if it belongs to this client. null otherwise (404 upstream). */
export async function loadClientJob(clientId: string, jobId: string): Promise<ClientJob | null> {
  const admin = createAdminClient();
  const { data: job } = await admin
    .from("jobs")
    .select("id, title, company, location, status, created_at, client_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job || job.client_id !== clientId) return null;

  const { data: rows } = await admin
    .from("job_candidates")
    .select("profile_id, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  const { candidates } = await loadCandidates();
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const list = (rows ?? [])
    .map((r) => byId.get(r.profile_id))
    .filter((c): c is CandidateDetail => !!c);

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    status: job.status,
    created_at: job.created_at,
    candidates: list,
  };
}
