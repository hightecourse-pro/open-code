"use client";

import { SnapshotLoading } from "@/components/patterns/stale-while-revalidate";

/**
 * The community's loading state (8/11): the fallback of a Suspense boundary that lives in the (app) LAYOUT,
 * not a loading.tsx. A loading.tsx is re-created with every sibling segment, so a click from /forum to /jobs
 * replaced the live page with it at once (the owner: ״זה מקפיא את המסך״). A boundary in the layout is already
 * showing content when she navigates, so React keeps the old page live until the new one is ready; only a cold
 * document load, where there is no page yet, shows this - the last snapshot of the route when there is one,
 * else the spinner (the owner, 31/8: a click that paints nothing reads as "the site is stuck").
 */
export function RouteFallback() {
  return (
    <SnapshotLoading
      fallback={
        <div className="flex flex-col items-center justify-center gap-3 py-28" role="status" aria-label="טוען">
          <span className="w-9 h-9 rounded-full border-[3px] border-tint-purple border-t-brand-purple animate-spin" />
          <span className="text-[13px] text-ink-400 font-semibold">רק רגע…</span>
        </div>
      }
    />
  );
}
