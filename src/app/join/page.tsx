import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getProfile } from "@/lib/auth";
import { signOut } from "../(auth)/actions";
import { applyAsMentor, revertMentorApplication } from "./actions";
import { reconcileSubscriberStatus } from "@/lib/payments/external";
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

const LOCKED_COPY: Record<string, string> = {
  chat: "התכתבות עם מנטורית נפתחת עם מנוי.",
  courses: "פתיחת קורס נפתחת עם מנוי.",
  ai: "כלי ה-AI נפתחים עם מנוי.",
  recordings: "צפייה בהקלטות נפתחת עם מנוי.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ locked?: string; status?: string }>;
}) {
  const { locked } = await searchParams;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status === "active") {
    // Bounce to the community only when the activation is REAL. A junior whose
    // status was flipped by hand with no live subscription used to be thrown
    // to the forum here instead of reaching the checkout (the owner,
    // 2026-08-30: "להצטרפות מעיף אותו למסך אחר ולא שולח אותו לתשלום").
    if (profile.role !== "junior") redirect("/forum");
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { count: liveSubs } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .eq("status", "active");
    if ((liveSubs ?? 0) > 0) redirect("/forum");
  }

  // She may have paid OUTSIDE the app (a direct Nedarim link) before signing
  // up — the payment waits in external_payments under her email. Claiming it
  // here means the checkout screen simply never asks a woman who already paid.
  {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    try {
      if (await reconcileSubscriberStatus(profile.id, user?.email)) redirect("/forum");
    } catch (e) {
      // redirect() throws by design — let it through; log anything else.
      if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
      console.error("[join] external claim failed:", e);
    }
  }

  // The mentor track is marked by ROLE, not tier: choosing it sets
  // role=mentor (join/actions.ts). Tier free alone also describes a regular
  // member whose subscription was canceled — אסתי, 5/9, hit the mentor
  // application screen here instead of the checkout she asked for.
  const isMentorTier = profile.role === "mentor";

  // Free tier (mentors) are approval-based; rejected members get a message.
  if (isMentorTier || profile.status === "rejected") {
    const rejected = profile.status === "rejected";
    const copy = rejected
      ? MESSAGE.rejected
      : isMentorTier
        ? {
            variant: "info" as const,
            title: "הבקשה שלך להצטרף כמנטורית אצלנו 👑",
            body: profile.profile_completed
              ? "אנחנו עוברות עליה — ברגע שתאושרי יגיע לך מייל, ומשם הכול פתוח. בינתיים את מוזמנת להסתובב בקהילה ולקרוא."
              : "נשאר רק למלא את שאלון המנטוריות — ניכנס לקהילה והשאלון יופיע. אחרי שתסיימי, נעבור על הבקשה ונעדכן אותך במייל.",
          }
        : MESSAGE.pending;
    return (
      <Shell>
        <div>
          <h1 className="t-h2">היי{profile.full_name ? ` ${profile.full_name}` : ", ברוכה הבאה"} 👋</h1>
          <p className="t-body-sm text-ink-500 mt-1">הנה מצב הדברים כרגע:</p>
        </div>
        <Alert variant={copy.variant} title={copy.title}>
          {copy.body}
        </Alert>
        {isMentorTier && !rejected && !profile.profile_completed && (
          <Link
            href="/forum"
            className="w-full inline-flex items-center justify-center font-display font-semibold text-[13.5px] py-2.5 rounded-md bg-brand-gradient text-white"
          >
            למילוי שאלון המנטוריות ←
          </Link>
        )}
        {isMentorTier && !rejected && (
          <form action={revertMentorApplication}>
            <Button type="submit" variant="ghost" size="sm" className="w-full">
              בעצם התכוונתי להצטרף כחברה במסלול מנוי
            </Button>
          </form>
        )}
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
  // Monthly only — a year up front is not an ask we make of a junior.
  const plans = [plansRec.monthly];

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
    // The member's email rides along so Nedarim can send her the receipt.
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Nedarim's report should carry her details (ID, phone, address). Whatever
    // she already answered in the questionnaire is pre-filled; phone + ID are
    // asked in the checkout itself when missing.
    const { data: qRows } = await supabase
      .from("config_questions")
      .select("id, key, options")
      .in("key", ["phone", "id_number", "city", "street", "house_number"]);
    const qByKey = new Map((qRows ?? []).map((q) => [q.key, q]));
    const qIds = (qRows ?? []).map((q) => q.id);
    const { data: ansRows } = qIds.length
      ? await supabase
          .from("profile_answers")
          .select("question_id, value")
          .eq("profile_id", profile.id)
          .in("question_id", qIds)
      : { data: [] };
    const ansById = new Map((ansRows ?? []).map((a) => [a.question_id, a.value]));
    const answer = (key: string): string => {
      const q = qByKey.get(key);
      const v = q ? ansById.get(q.id) : undefined;
      return typeof v === "string" ? v : "";
    };
    // City is stored as the option value — the report wants the Hebrew label.
    const cityQ = qByKey.get("city");
    const cityOpts = Array.isArray(cityQ?.options)
      ? (cityQ.options as unknown as { value: string; label: string }[])
      : [];
    const cityRaw = answer("city");
    const city = cityOpts.find((o) => o.value === cityRaw)?.label ?? cityRaw;
    const party = {
      profileId: profile.id,
      fullName: profile.full_name,
      email: user?.email ?? "",
      phone: answer("phone"),
      idNumber: answer("id_number"),
      street: [answer("street"), answer("house_number")].filter(Boolean).join(" "),
      city,
    };
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
            ? "המנוי שלך מושהה — אפשר לחדש ולחזור לקהילה. בינתיים את עדיין יכולה להסתובב ולקרוא."
            : "בחרי מסלול והצטרפי לקהילה. אנחנו ביחד מהצעד הראשון."}
        </p>
      </div>

      {locked && (
        <Alert variant="info">
          {LOCKED_COPY[locked] ?? "החלק הזה נפתח עם מנוי."} עד אז את מוזמנת להמשיך לקרוא ולהכיר 💜
        </Alert>
      )}

      {/* What the membership actually opens — the owner's list, stated before
          the price asks anything. */}
      <div className="bg-tint-purple/60 border border-[#DDC9EC] rounded-md p-4">
        <div className="font-display font-bold text-[14px] text-ink-1000 mb-1.5">מה מקבלים במנוי?</div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[13px] text-ink-700">
          <li>✓ כניסה לסשנים החיים</li>
          <li>✓ צפייה בהקלטות</li>
          <li>✓ ספריית הקורסים של הייטקורס</li>
          <li>✓ השתתפות בהאקתונים</li>
          <li>✓ עדיפות בהגשה למשרות</li>
          <li>✓ צ&apos;אט, מנטוריות וכלי AI</li>
        </ul>
      </div>

      <CheckoutPanel plans={plans} configured={configured} fieldsByPlan={fieldsByPlan} />

      {/* The mentor door: experienced women join to give, not to pay. */}
      {!renewing && (
        <div className="border border-[#EAD9A8] bg-tint-warm/60 rounded-md p-4 flex flex-col gap-2">
          <div className="font-display font-bold text-[14.5px] text-ink-1000">
            מגיעה בתור מנטורית? 👑
          </div>
          <p className="text-[13px] text-ink-700 leading-relaxed">
            מפתחת מנוסה שרוצה לתרום לקהילה — מענה לשאלות, ליווי אישי, האקתונים? למנטוריות אין מנוי:
            ממלאות שאלון קצר, ואנחנו מאשרות.
          </p>
          <form action={applyAsMentor}>
            <Button type="submit" variant="secondary" size="sm">
              הגשת בקשה למנטורית בקהילה
            </Button>
          </form>
        </div>
      )}

      {/* A free member is welcome inside — paying is what unlocks taking part. */}
      <Link
        href="/forum"
        className="text-center text-[13.5px] font-semibold text-brand-purple hover:underline"
      >
        {renewing ? "חזרה לקהילה" : "רוצה קודם להסתכל מסביב? להיכנס לקהילה ←"}
      </Link>

      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm" className="w-full">
          יציאה
        </Button>
      </form>
    </Shell>
  );
}
