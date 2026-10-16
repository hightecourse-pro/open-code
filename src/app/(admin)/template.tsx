import { randomUUID } from "node:crypto";
import { RevalidateStale, SnapshotCapture } from "@/components/patterns/stale-while-revalidate";

/** Same as the community template: fresh-or-replayed nonce + snapshot capture for every admin route. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <SnapshotCapture>
      <RevalidateStale nonce={randomUUID()} />
      {children}
    </SnapshotCapture>
  );
}
