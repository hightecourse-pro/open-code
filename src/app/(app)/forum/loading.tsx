"use client";

import { SnapshotLoading } from "@/components/patterns/stale-while-revalidate";
import { Bone, BoneHeader, BoneList, BonePage } from "@/components/patterns/route-skeleton";

/** Forum silhouette: header, composer box, filter chips, then topic rows. */
export default function ForumLoading() {
  return (
    <SnapshotLoading
      fallback={
        <BonePage>
          <BoneHeader />
          <Bone className="h-[92px] w-full rounded-lg bg-white border border-ink-200 shadow-sm" />
          <div className="flex gap-2">
            <Bone className="h-8 w-24 rounded-full bg-tint-purple" />
            <Bone className="h-8 w-32 rounded-full" />
          </div>
          <BoneList rows={7} />
        </BonePage>
      }
    />
  );
}
