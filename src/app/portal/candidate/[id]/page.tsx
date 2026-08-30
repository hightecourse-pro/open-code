// The candidate profile — the portal's showcase page.
//
// PRIVACY: every value on this page comes from loadCandidates(), which returns
// only listed/active/completed members and only answers to employer_visible
// questions. This file never queries profiles or profile_answers itself, and
// member_crm (VIP, internal notes) is not reachable from here at all.

import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Briefcase, Download } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { loadCandidates, type CandidateDetail } from "@/lib/portal/candidates";
import { CandidateProfileCard } from "@/components/patterns/candidate-profile-card";
import { favoriteIds } from "@/lib/portal/favorites";
import { candidateSentJobs, type SentCandidateJob } from "@/lib/portal/jobs";
import { CandidateFeedback } from "@/components/portal/candidate-feedback";
import { FavoriteButton } from "@/components/portal/favorite-button";
import { portalClient, requirePortalClient } from "@/app/portal/session";

/**
 * loadCandidates() is a whole-list read; cache() collapses the metadata pass
 * and the render pass into a single one per request.
 */
// includeMentors here: a mentor detail opened from the toggled-on list must
// resolve; the default LIST stays junior-only (the toggle lives on /portal).
const candidates = cache(() => loadCandidates({ includeMentors: true }));

/**
 * Same collapse for the sent-to-client jobs: metadata gate + page body read the
 * list once. Non-empty ⇒ the candidate was SENT to this client, and each entry
 * carries what the invite control needs (job + the client's saved feedback).
 */
const sentJobs = cache(candidateSentJobs);

async function findCandidate(id: string): Promise<CandidateDetail | null> {
  const { candidates: all } = await candidates();
  return all.find((c) => c.id === id) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const candidate = await findCandidate(id);
  if (!candidate) return { title: "מועמדת" };

  // Even a browser-tab title must not leak a name the client isn't allowed to
  // see — apply the same sent-to-client gate the page body applies.
  const client = await portalClient();
  if (client && !client.can_search && (await sentJobs(client.id, candidate.id)).length === 0) {
    return { title: "מועמדת" };
  }
  return { title: candidate.name };
}

export default async function CandidateProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cv?: string }>;
}) {
  const client = await requirePortalClient();
  const [{ id }, { cv }] = await Promise.all([params, searchParams]);

  // Not being in loadCandidates() is indistinguishable from not existing — that
  // is the whole listing gate, and it must not leak which of the two it was.
  const candidate = await findCandidate(id);
  if (!candidate) notFound();

  // Without free search, a client may only open candidates we sent to one of
  // her jobs; anyone else must be indistinguishable from not existing. The same
  // list also powers the invite-to-interview control in the side rail — for ANY
  // client (free search included) the candidate was sent to.
  const sent = await sentJobs(client.id, candidate.id);
  if (!client.can_search && sent.length === 0) notFound();

  const favs = await favoriteIds(client.id);
  const cvHref = `/portal/candidate/${candidate.id}/cv`;

  return (
    <div className="flex flex-col gap-6 pb-24 lg:pb-0">
      <Link
        href={client.can_search ? "/portal" : "/portal/jobs"}
        className="t-body-sm inline-flex w-fit items-center gap-1.5 font-semibold text-ink-700 transition-colors duration-150 hover:text-brand-purple print:hidden"
      >
        <ArrowRight size={16} />
        {client.can_search ? "חזרה לחיפוש" : "חזרה למשרות שלי"}
      </Link>

      {cv === "none" && (
        <Alert variant="info" title="עדיין אין כאן קורות חיים">
          המועמדת עוד לא העלתה קובץ. כל מה שהיא שיתפה נמצא בפרופיל שלפניכם — ואם חשוב לכם הקובץ,
          כתבו לנו ונשלים אותו מולה.
        </Alert>
      )}
      {cv === "error" && (
        <Alert variant="warn" title="לא הצלחנו לפתוח את הקובץ">
          משהו השתבש בדרך. נסו שוב בעוד רגע, ואם זה חוזר — כתבו לנו ונטפל בזה.
        </Alert>
      )}

      {/* ------------------------------------------------ body + side rail */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px] lg:items-start">
        <div className="flex flex-col gap-6">
          {/* ONE renderer with the member preview and the team view — the
              favorite star rides in as page-specific chrome. */}
          <CandidateProfileCard
            candidate={candidate}
            headerExtra={<FavoriteButton profileId={candidate.id} initial={favs.has(candidate.id)} />}
          />

          {/* The rail collapses on narrow screens — same as the CV button, the
              invite control gets a mobile home at the end of the profile. */}
          {sent.length > 0 && (
            <div className="lg:hidden print:hidden">
              <InviteRail jobs={sent} candidate={candidate} />
            </div>
          )}
        </div>

        <aside className="hidden lg:sticky lg:top-24 lg:block print:hidden">
          <div className="flex flex-col gap-4">
            <div className="rounded-[18px] border border-ink-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-base font-bold text-ink-1000">קורות חיים</h2>
              <p className="t-caption mt-1.5">
                הקובץ ש{candidate.name} שיתפה איתנו, מוכן להורדה.
              </p>
              <Button asChild variant="primary" size="md" className="mt-4 w-full">
                <a href={cvHref}>
                  <Download size={17} />
                  הורדת קורות חיים
                </a>
              </Button>
            </div>

            <InviteRail jobs={sent} candidate={candidate} />
          </div>
        </aside>
      </div>

      {/* The rail collapses on narrow screens, so the primary action follows
          the reader down the page instead of disappearing above the fold. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-200 bg-white/95 p-3 backdrop-blur-sm lg:hidden print:hidden">
        <Button asChild variant="primary" size="md" className="w-full">
          <a href={cvHref}>
            <Download size={17} />
            הורדת קורות חיים
          </a>
        </Button>
      </div>
    </div>
  );
}

/**
 * The invite-to-interview control, right on the profile the client is reading —
 * the exact CandidateFeedback the job pages use, one per job the candidate was
 * sent on, so its state is shared with the job page and the team is notified.
 * No contact details appear anywhere: the invite goes through us, by design.
 */
function InviteRail({
  jobs,
  candidate,
}: {
  jobs: SentCandidateJob[];
  candidate: CandidateDetail;
}) {
  return (
    <div className="flex flex-col gap-4">
      {jobs.map((job) => (
        <div key={job.jobId}>
          <p className="t-caption flex items-center gap-1.5">
            <Briefcase size={13} className="shrink-0 text-ink-500" />
            <span className="truncate">{job.jobTitle}</span>
          </p>
          <CandidateFeedback
            jobId={job.jobId}
            profileId={candidate.id}
            candidateName={candidate.name}
            initialMarked={job.interviewMarked}
            initialNote={job.clientNote}
          />
        </div>
      ))}
    </div>
  );
}
