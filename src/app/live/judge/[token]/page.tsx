import type { Metadata } from "next";
import { judgeView } from "@/lib/hackathon-live";
import { JudgeScreen } from "./judge-screen";

export const metadata: Metadata = { title: "שיפוט הגמר", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * מסך השופטת (the owner, 26/10): the personal link a judge opens on her phone
 * during the finals - her challenge's finalists, 1-10 per criterion, saved on
 * every tap. The token in the link is the whole identity; a wrong one gets a
 * plain message, never a login.
 */
export default async function JudgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const initial = await judgeView(token);
  if (!initial) {
    return (
      <main dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-ink-50">
        <div className="bg-white border border-ink-200 rounded-xl shadow-md p-8 max-w-md text-center flex flex-col gap-3">
          <div className="text-3xl">🔑</div>
          <h1 className="font-display text-xl font-bold text-ink-1000">הקישור הזה לא מוכר</h1>
          <p className="text-ink-700">בקשי מהמארגנת את הקישור האישי שלך לשיפוט הגמר.</p>
        </div>
      </main>
    );
  }
  return <JudgeScreen token={token} initial={initial} />;
}
