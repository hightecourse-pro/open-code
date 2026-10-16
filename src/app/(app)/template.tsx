import { RevalidateStale, SnapshotCapture } from "@/components/patterns/stale-while-revalidate";

/**
 * Re-created on every navigation (unlike the layout), which is exactly what
 * the stale-while-revalidate pieces need: a mount per navigation to check
 * whether this render was replayed from the router cache, and a wrapper
 * around the route whose settled render can be snapshotted.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <SnapshotCapture>
      <RevalidateStale />
      {children}
    </SnapshotCapture>
  );
}
