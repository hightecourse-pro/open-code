import type { Metadata } from "next";
import { hasUsableKey } from "@/lib/ai/keys";
import { AiKeyBanner } from "@/components/patterns/ai-key-banner";
import { InterviewSetup } from "@/components/patterns/interview-setup";

export const metadata: Metadata = { title: "סימולטור ראיונות" };

export default async function InterviewPage() {
  const hasKey = await hasUsableKey();
  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <AiKeyBanner hasKey={hasKey} />
      <InterviewSetup hasKey={hasKey} />
    </div>
  );
}
