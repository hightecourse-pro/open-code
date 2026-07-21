import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPortalClient } from "@/lib/portal/auth";
import { loadCandidates } from "@/lib/portal/candidates";
import { favoriteIds } from "@/lib/portal/favorites";
import { CandidateSearch } from "@/components/portal/candidate-search";

export const metadata: Metadata = { title: "חיפוש מועמדות" };

export default async function PortalSearchPage() {
  const client = await getPortalClient();
  if (!client) redirect("/portal/login");

  // loadCandidates() is the only door to candidate data: it filters to listed
  // profiles and to employer-visible answers, so nothing else needs to be
  // checked here. member_crm (VIP, internal notes) is never touched.
  const { candidates, catalogue } = await loadCandidates();
  const favs = await favoriteIds(client.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 flex flex-col gap-6">
      <header>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מועמדות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">חיפוש מועמדות</h1>
        <p className="t-body-sm text-ink-500">
          {client.company_name} — {candidates.length} מועמדות זמינות לחיפוש. אפשר לסנן לפי
          פרמטרים, או פשוט לתאר במילים שלך את מי שאתן מחפשות.
        </p>
      </header>

      <CandidateSearch candidates={candidates} catalogue={catalogue} favoriteIds={[...favs]} />
    </div>
  );
}
