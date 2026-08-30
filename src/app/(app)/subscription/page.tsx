import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCommunityAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPricing } from "@/lib/payments/pricing";
import { SubscriptionCard } from "@/components/patterns/subscription-card";

export const metadata: Metadata = { title: "המנוי שלי" };
export const dynamic = "force-dynamic";

/**
 * The subscription's own screen (PM: out of the profile, into the menu).
 * Mentors and staff never pay — the sidebar hides the item for mentors and
 * this covers a typed-in URL.
 */
export default async function SubscriptionPage() {
  const profile = await requireCommunityAccess();
  if (profile.role === "mentor") redirect("/profile");

  // Staff don't pay (the owner, 30/8: "אם אני צוות למה המנוי פעיל בתשלום?") —
  // an admin sees a staff notice, never billing details.
  if (profile.role === "admin") {
    return (
      <div className="flex flex-col gap-5 max-w-2xl">
        <div>
          <span className="font-mono text-xs text-brand-pink-deep">&lt;מנוי/&gt;</span>
          <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">המנוי שלי</h1>
        </div>
        <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-[14.5px] text-ink-700">
          חשבון צוות 💜 הכול פתוח לך בלי מנוי ובלי תשלום — אין כאן מה לנהל.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: subscription }, pricing] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status, current_period_end, canceled_at")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    getPricing(),
  ]);

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מנוי/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">המנוי שלי</h1>
        <p className="t-body-sm text-ink-700">
          כל מה שקשור לתשלום והחידוש — במקום אחד, בשליטה שלך.
        </p>
      </div>

      {subscription ? (
        <SubscriptionCard
          status={subscription.status}
          periodEnd={subscription.current_period_end}
          canceledAt={subscription.canceled_at}
          priceShekels={Math.round(pricing.monthlyAgorot / 100)}
        />
      ) : (
        <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-[14.5px] text-ink-700">
          עדיין אין לך מנוי פעיל — עם מנוי נפתחים הקורסים, ההקלטות, הצ&apos;אט וכלי ה-AI 💜{" "}
          <a href="/join" className="text-brand-purple font-semibold">
            להצטרפות ←
          </a>
        </div>
      )}
    </div>
  );
}
