/**
 * Instant feedback for every in-app navigation. Without a loading boundary a
 * click on the menu paints NOTHING until the server finishes rendering the
 * whole page — on a cold start that reads as "the site is stuck" (the owner,
 * 31/8: "לחיצה על התפריט לא גוררת תגובה"). The sidebar stays; only the
 * content area shows the spinner.
 */
export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-28" role="status" aria-label="טוען">
      <span className="w-9 h-9 rounded-full border-[3px] border-tint-purple border-t-brand-purple animate-spin" />
      <span className="text-[13px] text-ink-400 font-semibold">רק רגע…</span>
    </div>
  );
}
