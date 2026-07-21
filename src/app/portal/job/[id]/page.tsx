// A single job, focused on its curated candidate list. This is the page a
// company opens straight from the "מועמדות חדשות" email, so it stays clean.
//
// PRIVACY: loadClientJob() returns the job only if it belongs to this client
// (null → 404, without leaking whether the job exists), and its candidates come
// through loadCandidates() — listed / employer-visible members only. No
// member_crm, no personal fields, no VIP.

import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Briefcase, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui";
import { CandidateCard } from "@/components/portal/candidate-card";
import { loadClientJob } from "@/lib/portal/jobs";
import { favoriteIds } from "@/lib/portal/favorites";
import { requirePortalClient } from "@/app/portal/session";

/**
 * generateMetadata and the render both need the job; cache() collapses the two
 * passes into a single load per request (keyed on clientId + jobId).
 */
const clientJob = cache(loadClientJob);

/** "3 מועמדות" — with the singular form for one. */
function candidatesLabel(n: number): string {
  if (n === 0) return "אין מועמדות עדיין";
  if (n === 1) return "מועמדת אחת";
  return `${n} מועמדות`;
}

/** Job lifecycle pill. Jobs are open/closed in the admin. */
function JobStatus({ status }: { status: string }) {
  if (status === "open") return <Badge variant="mint" dot>פעילה</Badge>;
  if (status === "closed") return <Badge variant="tech">סגורה</Badge>;
  return <Badge variant="tech">{status}</Badge>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const client = await requirePortalClient();
  const { id } = await params;
  const job = await clientJob(client.id, id);
  return { title: job ? job.title : "משרה" };
}

export default async function PortalJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const client = await requirePortalClient();
  const { id } = await params;

  const [job, favs] = await Promise.all([
    clientJob(client.id, id),
    favoriteIds(client.id),
  ]);

  // Not this client's job (or not a job at all) is a 404 either way — the check
  // lives in loadClientJob so this page can never surface someone else's roster.
  if (!job) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 flex flex-col gap-6">
      <Link
        href="/portal/jobs"
        className="t-body-sm inline-flex w-fit items-center gap-1.5 font-semibold text-ink-700 transition-colors duration-150 hover:text-brand-purple"
      >
        <ArrowRight size={16} />
        חזרה למשרות שלי
      </Link>

      {/* ---------------------------------------------------------- header */}
      <header className="overflow-hidden rounded-[18px] border border-ink-200 bg-white shadow-sm">
        <div aria-hidden className="bg-brand-gradient h-1.5" />
        <div className="p-6 sm:p-8">
          <span className="font-mono text-xs text-brand-pink-deep">&lt;משרה/&gt;</span>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[30px] leading-tight font-black text-ink-1000">
              {job.title}
            </h1>
            <JobStatus status={job.status} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 t-body-sm text-ink-700">
            <span className="inline-flex items-center gap-1.5">
              <Briefcase size={15} className="text-ink-500" />
              {job.company}
            </span>
            {job.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} className="text-ink-500" />
                {job.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Users size={15} className="text-ink-500" />
              {candidatesLabel(job.candidates.length)}
            </span>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------ candidate list */}
      <section className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between gap-3 border-t border-ink-200 pt-5">
          <h2 className="font-display text-[17px] font-bold text-ink-1000">
            המועמדות שריכזנו עבורכם
          </h2>
          {job.candidates.length > 0 && (
            <span className="t-caption">{candidatesLabel(job.candidates.length)}</span>
          )}
        </div>

        {job.candidates.length === 0 ? (
          <p className="t-body-sm rounded-xl border border-dashed border-ink-200 bg-white/70 px-4 py-10 text-center text-ink-500">
            עדיין לא צורפו מועמדות למשרה הזו — נעדכן אתכם ברגע שנאתר מועמדות מתאימות.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 list-none p-0 m-0">
            {job.candidates.map((candidate) => (
              <li key={candidate.id}>
                <CandidateCard candidate={candidate} favorited={favs.has(candidate.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
