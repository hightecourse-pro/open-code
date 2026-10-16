import { RevalidateStale, SnapshotCapture } from "@/components/patterns/stale-while-revalidate";

/** Same as the community template: a mount per navigation + snapshot capture for every admin route. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <SnapshotCapture>
      <RevalidateStale />
      {children}
    </SnapshotCapture>
  );
}
