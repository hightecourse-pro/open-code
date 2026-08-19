import { Bone, BoneHeader, BonePage } from "@/components/patterns/route-skeleton";

/** Jobs silhouette: header, the two info banners, tabs, then job cards. */
export default function JobsLoading() {
  return (
    <BonePage>
      <BoneHeader />
      <Bone className="h-12 w-full bg-tint-indigo" />
      <Bone className="h-12 w-full bg-tint-warm" />
      <div className="flex gap-2.5">
        <Bone className="h-16 flex-1 rounded-md" />
        <Bone className="h-16 flex-1 rounded-md" />
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="bg-white border border-ink-200 rounded-lg shadow-sm p-5 flex flex-col gap-3"
          >
            <Bone className="h-5 w-1/2 bg-ink-200" />
            <Bone className="h-3.5 w-full" />
            <Bone className="h-3.5 w-4/5" />
            <div className="flex gap-2">
              <Bone className="h-6 w-16 rounded-full bg-tint-purple" />
              <Bone className="h-6 w-16 rounded-full bg-tint-pink" />
              <Bone className="h-6 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </BonePage>
  );
}
