/**
 * Route-transition loading for the admin area — the heavy screens (analytics,
 * review center) used to render nothing while the server worked, which read
 * as a dead click (the owner, 2026-08-30: "בכל פעולה שלוקחת זמן צריך אנימציה").
 */
export default function AdminLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <span className="relative flex h-10 w-10">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-pink-deep/30" />
          <span className="relative inline-flex h-10 w-10 animate-spin rounded-full border-[3px] border-ink-200 border-t-brand-pink-deep" />
        </span>
        <span className="font-display text-sm font-semibold text-ink-500">רק רגע, טוענות…</span>
      </div>
    </div>
  );
}
