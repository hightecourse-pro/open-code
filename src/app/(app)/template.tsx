import { randomUUID } from "node:crypto";
import { RevalidateStale, SnapshotCapture } from "@/components/patterns/stale-while-revalidate";

/**
 * Re-rendered on every navigation (unlike the layout): mints the nonce that
 * tells the client whether this render is fresh or replayed from the router
 * cache, and wraps the route so its settled render can be snapshotted.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <SnapshotCapture>
      <RevalidateStale nonce={randomUUID()} />
      {children}
    </SnapshotCapture>
  );
}
