import type { Metadata } from "next";
import { hasUsableKey } from "@/lib/ai/keys";
import { AiKeyBanner } from "@/components/patterns/ai-key-banner";
import { CvCheckerForm } from "@/components/patterns/cv-checker-form";

export const metadata: Metadata = { title: "בודקת קורות חיים" };

export default async function CvCheckerPage() {
  const hasKey = await hasUsableKey();
  return (
    <div className="flex flex-col gap-5">
      <AiKeyBanner hasKey={hasKey} />
      <CvCheckerForm />
    </div>
  );
}
