import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalClient } from "@/lib/portal/auth";
import { loadCandidates } from "@/lib/portal/candidates";
import { favoriteIds } from "@/lib/portal/favorites";
import { CandidateSearch } from "@/components/portal/candidate-search";

// Gemini rides a model-chain with retries — a stormy run outlives the platform
// default window. Server actions inherit the page segment they POST from.
export const maxDuration = 300;

export const metadata: Metadata = { title: "חיפוש מועמדות" };

export default async function PortalSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ mentors?: string }>;
}) {
  const client = await getPortalClient();
  if (!client) redirect("/portal/login");

  // Default contract: a client sees only the candidates we sent to her jobs.
  // Free search is an explicit per-client grant.
  if (!client.can_search) redirect("/portal/jobs");

  // Mentors are invisible here unless the recruiter explicitly flips the
  // toggle — by default their data never even reaches this page.
  const includeMentors = (await searchParams).mentors === "1";

  // loadCandidates() is the only door to candidate data: it filters to listed
  // profiles and to employer-visible answers, so nothing else needs to be
  // checked here. member_crm (VIP, internal notes) is never touched.
  const { candidates, catalogue } = await loadCandidates({ includeMentors });
  const favs = await favoriteIds(client.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 flex flex-col gap-6">
      <header>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מועמדות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">חיפוש מועמדות</h1>
        <p className="t-body-sm text-ink-500">
          {/* RLM after the dash keeps the count attached to the Hebrew text even
              when the company name ends in Latin characters. */}
          {client.company_name} —{"‏"}{" "}
          {candidates.length === 1
            ? "מועמדת אחת מחכה כאן."
            : `${candidates.length} מועמדות מחכות כאן.`}{" "}
          סננו לפי פרמטרים, או כתבו במילים שלכם מי חסרה לכם בצוות.
        </p>
      </header>

      <div className="-mt-2">
        {includeMentors ? (
          <a href="/portal" className="text-[12.5px] font-semibold text-brand-purple hover:underline">
            👑 מוצגות גם מנטוריות — להסתרה
          </a>
        ) : (
          <a href="/portal?mentors=1" className="text-[12.5px] text-ink-500 hover:text-brand-purple hover:underline">
            סימון מיוחד: הצגת גם מנטוריות הקהילה 👑
          </a>
        )}
      </div>

      <CandidateSearch candidates={candidates} catalogue={catalogue} favoriteIds={[...favs]} />
    </div>
  );
}
