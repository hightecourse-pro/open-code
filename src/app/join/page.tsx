import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getProfile } from "@/lib/auth";
import { signOut } from "../(auth)/actions";
import { Alert, Button, Logo } from "@/components/ui";
import { CheckoutPanel } from "@/components/patterns/checkout-panel";
import { buildTransactionFields, isNedarimConfigured } from "@/lib/payments/nedarim";
import { getPricing } from "@/lib/payments/pricing";
import { buildPlans } from "@/lib/payments/plans";
import type { SubscriptionPlan } from "@/types/database";

const MESSAGE: Record<string, { variant: "info" | "warn" | "danger"; title: string; body: string }> = {
  pending: {
    variant: "info",
    title: "הבקשה שלך התקבלה 💜",
    body: "אנחנו עוברות עליה ונאשר אותך ממש בקרוב. נעדכן אותך במייל ברגע שהכול מוכן.",
  },
  rejected: {
    variant: "danger",
    title: "לא הצלחנו לאשר את החברות הפעם",
    body: "אם נראה לך שזו טעות — כתבי לנו ונשמח לבדוק יחד.",
  },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 relative py-10">
      <div className="bg-brand-glow absolute inset-0 -z-10" />
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <Logo width={180} priority />
        <div className="bg-white border border-ink-200 rounded-xl shadow-md p-8 w-full flex flex-col gap-5">
          {children}
        </div>
      </div>
    </main>
  );
}

export default async function JoinPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status === "active") redirect("/forum");

  const isMentorTier = profile.member_tier === "free";

  // Free tier (mentors) are approval-based; rejected members get a message.
  if (isMentorTier || profile.status === "rejected") {
    const copy = MESSAGE[profile.status === "rejected" ? "rejected" : "pending"];
    return (
      <Shell>
        <div>
          <h1 className="t-h2">היי{profile.full_name ? ` ${profile.full_name}` : ", ברוכה הבאה"} 👋</h1>
          <p className="t-body-sm text-ink-500 mt-1">הנה מצב הדברים כרגע:</p>
        </div>
        <Alert variant={copy.variant} title={copy.title}>
          {copy.body}
        </Alert>
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="w-full">
            יציאה
          </Button>
        </form>
      </Shell>
    );
  }

  // Paid tier, pending or paused → checkout. Pricing is admin-configurable.
  const pricing = await getPricing();
  const plansRec = buildPlans(pricing);
  const plans = [plansRec.monthly, plansRec.annual];

  const configured = isNedarimConfigured();
  let fieldsByPlan: Record<SubscriptionPlan, Record<string, string>> | undefined;
  if (configured) {
    // Prefer an explicit site URL; otherwise derive an absolute origin from the
    // request so Nedarim always gets a valid (non-relative) CallBack URL.
    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const origin = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${proto}://${host}` : "");
    const callbackUrl = `${origin}/api/webhooks/payments`;
    const party = { profileId: profile.id, fullName: profile.full_name, email: "" };
    fieldsByPlan = {
      monthly: buildTransactionFields(plansRec.monthly, party, callbackUrl),
      annual: buildTransactionFields(plansRec.annual, party, callbackUrl),
    };
  }

  const renewing = profile.status === "paused";

  return (
    <Shell>
      <div>
        <h1 className="t-h2">{renewing ? "טוב שחזרת 💜" : "כמעט שם!"}</h1>
        <p className="t-body-sm text-ink-500 mt-1">
          {renewing
            ? "המנוי שלך מושהה — אפשר לחדש ולחזור לקהילה."
            : "בחרי מסלול והצטרפי לקהילה. אנחנו ביחד מהצעד הראשון."}
        </p>
      </div>
      <CheckoutPanel plans={plans} configured={configured} fieldsByPlan={fieldsByPlan} />
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" className="w-full">
          יציאה
        </Button>
      </form>
    </Shell>
  );
}
