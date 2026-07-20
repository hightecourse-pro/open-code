import type { Metadata } from "next";
import { hasUsableKey } from "@/lib/ai/keys";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { AiKeyBanner } from "@/components/patterns/ai-key-banner";
import { CvCheckerForm } from "@/components/patterns/cv-checker-form";
import { UpgradeCard } from "@/components/patterns/upgrade-prompt";

export const metadata: Metadata = { title: "בודקת קורות חיים" };

export default async function CvCheckerPage() {
  const profile = await requireCommunityAccess();
  if (!isSubscriber(profile)) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <span className="font-mono text-xs text-brand-pink-deep">&lt;כלי AI/&gt;</span>
          <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">בודקת קורות חיים</h1>
          <p className="t-body-sm text-ink-700">
            ניתוח חכם של קורות החיים שלך, עם תובנות מעשיות והתאמה למשרה מסוימת.
          </p>
        </div>
        <UpgradeCard
          title="כלי ה-AI נפתחים עם מנוי"
          body="בודקת קורות החיים נותנת לך משוב מפורט על הקו״ח שלך ובודקת התאמה למשרה — הכול נפתח עם מנוי לקהילה."
        />
      </div>
    );
  }

  const hasKey = await hasUsableKey();
  return (
    <div className="flex flex-col gap-5">
      <AiKeyBanner hasKey={hasKey} />
      <CvCheckerForm />
    </div>
  );
}
