// The portal's "המועדפות שלי" — every candidate this client starred, in one place.
//
// PRIVACY: the candidate cards come from listFavorites(), which reads only
// through loadCandidates() (listed profiles, employer-visible answers). No
// member_crm, no VIP, no personal fields are reachable from here.

import type { Metadata } from "next";
import Link from "next/link";
import { Search, Star } from "lucide-react";
import { requirePortalClient } from "@/app/portal/session";
import { listFavorites } from "@/lib/portal/favorites";
import { CandidateCard } from "@/components/portal/candidate-card";

export const metadata: Metadata = { title: "המועדפות שלי" };

export default async function PortalFavoritesPage() {
  const client = await requirePortalClient();
  const candidates = await listFavorites(client.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 flex flex-col gap-6">
      <header>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מועמדות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">המועדפות שלי</h1>
        <p className="t-body-sm text-ink-500">
          {candidates.length === 0
            ? "המועמדות שתסמנו בחיפוש יישמרו כאן, לחזרה מהירה בכל עת."
            : `${candidates.length} מועמדות ששמרתם לצפייה חוזרת.`}
        </p>
      </header>

      {candidates.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-ink-200 bg-white p-10 text-center flex flex-col items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tint-warm text-crown-gold">
            <Star size={26} />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-ink-1000">עדיין לא סימנתם מועדפות</p>
            <p className="t-body-sm text-ink-500 mt-1 max-w-[46ch] mx-auto">
              סמנו ⭐ על מועמדת בחיפוש כדי לשמור אותה כאן.
            </p>
          </div>
          <Link
            href="/portal"
            className="inline-flex items-center gap-2 rounded-full bg-brand-pink-deep px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-purple hover:no-underline"
          >
            <Search size={16} />
            חיפוש מועמדות
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 list-none p-0 m-0">
          {candidates.map((c) => (
            <li key={c.id}>
              <CandidateCard candidate={c} favorited={true} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
