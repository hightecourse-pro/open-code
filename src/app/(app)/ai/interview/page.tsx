import type { Metadata } from "next";
import { hasUsableKey } from "@/lib/ai/keys";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { AiKeyBanner } from "@/components/patterns/ai-key-banner";
import { InterviewSetup } from "@/components/patterns/interview-setup";
import { UpgradeCard } from "@/components/patterns/upgrade-prompt";

export const metadata: Metadata = { title: "סימולטור ראיונות" };

export default async function InterviewPage() {
  const profile = await requireCommunityAccess();
  if (!isSubscriber(profile)) {
    return (
      <div className="flex flex-col gap-5 max-w-2xl">
        <div>
          <span className="font-mono text-xs text-brand-pink-deep">&lt;כלי AI/&gt;</span>
          <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">סימולטור ראיונות</h1>
          <p className="t-body-sm text-ink-700">
            תרגול ראיון עבודה אמיתי, עם משוב מחזק בסוף — כדי שתגיעי בטוחה.
          </p>
        </div>
        <UpgradeCard
          title="כלי ה-AI נפתחים עם מנוי"
          body="סימולטור הראיונות מתרגל איתך ראיון HR או טכני ונותן משוב אישי בסוף — הכול נפתח עם מנוי לקהילה."
        />
      </div>
    );
  }

  const hasKey = await hasUsableKey();
  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <AiKeyBanner hasKey={hasKey} />
      <InterviewSetup hasKey={hasKey} />
    </div>
  );
}
