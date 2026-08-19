import { BoneHeader, BoneList, BonePage } from "@/components/patterns/route-skeleton";

/**
 * The default loading state for every community screen: the shell stays put
 * and the content column shows a quiet pulse the moment she navigates —
 * instead of the whole app freezing until the data chain resolves.
 * Routes with their own loading.tsx (forum, chat, jobs) override this with a
 * closer silhouette.
 */
export default function Loading() {
  return (
    <BonePage>
      <BoneHeader />
      <BoneList rows={6} />
    </BonePage>
  );
}
