import type { Metadata } from "next";
import Link from "next/link";
import { judgeView } from "@/lib/hackathon-live";
import { JudgeScreen } from "../judge-screen";

export const metadata: Metadata = { title: "שיפוט הגמר", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** A judge's direct link (the token from the control panel) - the same screen, without the entrance. */
export default async function JudgeTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const initial = await judgeView(token);
  if (!initial) {
    return (
      <main dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-ink-50">
        <div className="bg-white border border-ink-200 rounded-xl shadow-md p-8 max-w-md text-center flex flex-col gap-3">
          <div className="text-3xl">🔑</div>
          <h1 className="font-display text-xl font-bold text-ink-1000">הקישור הזה לא מוכר</h1>
          <p className="text-ink-700">
            להיכנס לשיפוט דרך{" "}
            <Link href="/live/judge" className="text-brand-purple underline">
              דף השופטות
            </Link>{" "}
            עם שמך וקוד השופטות.
          </p>
        </div>
      </main>
    );
  }
  return <JudgeScreen token={token} initial={initial} />;
}
