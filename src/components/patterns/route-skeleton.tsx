import { cn } from "@/lib/utils";

/**
 * Skeleton building blocks for the route loading states (loading.tsx files).
 * The shell (sidebar, nav) stays interactive while a page's data loads — these
 * fill the content column so navigation feels instant instead of frozen.
 * Ink/tint palette only, one gentle shared pulse; screen readers get a single
 * status line instead of a pile of gray boxes.
 */

/** One pulsing placeholder block. Size and roundness come from className. */
export function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-ink-100", className)} />;
}

/** A circle — where an avatar will land. */
export function BoneCircle({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-full bg-ink-100 shrink-0", className)} />;
}

/** The page header every screen opens with: mono tag, title, one body line. */
export function BoneHeader() {
  return (
    <div className="flex flex-col gap-2">
      <Bone className="h-3 w-14 bg-tint-pink" />
      <Bone className="h-7 w-44 bg-ink-200" />
      <Bone className="h-3.5 w-full max-w-[340px]" />
    </div>
  );
}

/** A list-row card: avatar + two lines, like a forum topic or a member row. */
export function BoneRow() {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3.5">
      <BoneCircle className="w-9 h-9" />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Bone className="h-4 w-3/5 bg-ink-200" />
        <Bone className="h-3 w-2/5" />
      </div>
      <Bone className="h-3 w-10" />
    </div>
  );
}

/** A stack of BoneRows inside the white card the real lists use. */
export function BoneList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-white border border-ink-200 rounded-lg shadow-sm divide-y divide-ink-100">
      {Array.from({ length: rows }, (_, i) => (
        <BoneRow key={i} />
      ))}
    </div>
  );
}

/** Wraps a skeleton so assistive tech hears one calm sentence, not boxes. */
export function BonePage({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-5">
      <span className="sr-only">עוד רגע קטן, הדף נטען… 💜</span>
      {children}
    </div>
  );
}
