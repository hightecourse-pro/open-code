// The portal's "המשרות שלי" section — every job this company has with us, each
// with the candidate list an admin curated for it.
//
// PRIVACY: candidates come only from loadClientJobs(), which routes through
// loadCandidates() (listed / employer-visible members only). This file never
// touches member_crm, profile_answers or personal fields, and never shows VIP.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Briefcase, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui";
import { CandidateCard } from "@/components/portal/candidate-card";
import { loadClientJobs } from "@/lib/portal/jobs";
import { favoriteIds } from "@/lib/portal/favorites";
import { requirePortalClient } from "@/app/portal/session";

export const metadata: Metadata = { title: "המשרות שלי" };

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

export default async function PortalJobsPage() {
  const client = await requirePortalClient();

  const [jobs, favs] = await Promise.all([
    loadClientJobs(client.id),
    favoriteIds(client.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 flex flex-col gap-8">
      <header>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מועמדות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">המשרות שלי</h1>
        <p className="t-body-sm text-ink-500">
          {client.company_name} — ריכזנו לכל משרה את המועמדות המתאימות ביותר. אפשר להיכנס לכל
          משרה לתצוגה ממוקדת, ולסמן בכוכב את מי שבא לכם לחזור אליה.
        </p>
      </header>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-12 text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-tint-purple text-brand-purple">
            <Briefcase size={22} />
          </span>
          <p className="font-display text-lg font-bold text-ink-1000">
            עדיין אין משרות פעילות — נעדכן אתכם.
          </p>
          <p className="t-body-sm text-ink-500 mt-1.5 mx-auto max-w-[46ch]">
            ברגע שנפתח עבורכם משרה ונאתר לה מועמדות מתאימות, הן יופיעו כאן ותקבלו על כך עדכון.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          {jobs.map((job) => (
            <section key={job.id} className="flex flex-col gap-5">
              {/* ------------------------------------------------ job header */}
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-ink-200 pb-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-display text-xl font-bold text-ink-1000">{job.title}</h2>
                    <JobStatus status={job.status} />
                  </div>
                  <div className="t-body-sm text-ink-500 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase size={14} className="text-ink-400" />
                      {job.company}
                    </span>
                    {job.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} className="text-ink-400" />
                        {job.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 font-semibold text-ink-700">
                      <Users size={14} className="text-ink-400" />
                      {candidatesLabel(job.candidates.length)}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/portal/job/${job.id}`}
                  className="t-body-sm inline-flex shrink-0 items-center gap-1.5 font-semibold text-brand-purple transition-colors duration-150 hover:text-brand-pink-deep hover:no-underline"
                >
                  לצפייה במשרה
                  <ArrowLeft size={16} />
                </Link>
              </div>

              {/* ------------------------------------------- candidate grid */}
              {job.candidates.length === 0 ? (
                <p className="t-body-sm rounded-xl border border-dashed border-ink-200 bg-white/70 px-4 py-8 text-center text-ink-500">
                  עדיין לא צורפו מועמדות למשרה הזו — נעדכן אתכם ברגע שיהיו.
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
          ))}
        </div>
      )}
    </div>
  );
}
