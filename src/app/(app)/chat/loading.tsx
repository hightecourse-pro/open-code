import { Bone, BoneCircle, BonePage } from "@/components/patterns/route-skeleton";

/** Chat silhouette: title, then the two panes — thread list and open thread. */
export default function ChatLoading() {
  return (
    <BonePage>
      <Bone className="h-7 w-32 bg-ink-200" />
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 min-h-[420px] h-[calc(100dvh-120px)]">
        <div className="bg-white border border-ink-200 rounded-[18px] p-2 shadow-sm flex flex-col gap-1">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2.5">
              <BoneCircle className="w-8 h-8" />
              <div className="flex-1 flex flex-col gap-1.5">
                <Bone className="h-3.5 w-3/4 bg-ink-200" />
                <Bone className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white border border-ink-200 rounded-[18px] shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2.5 pb-3 border-b border-ink-100">
            <BoneCircle className="w-8 h-8" />
            <Bone className="h-4 w-36 bg-ink-200" />
          </div>
          <Bone className="h-10 w-1/2 rounded-xl self-start bg-tint-purple" />
          <Bone className="h-10 w-2/5 rounded-xl self-end bg-tint-pink" />
          <Bone className="h-10 w-3/5 rounded-xl self-start bg-tint-purple" />
        </div>
      </div>
    </BonePage>
  );
}
