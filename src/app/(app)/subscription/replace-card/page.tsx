// Self-serve card replacement (the owner, 1/9: "החלפת אשראי ניתנת בכל אתר
// באופן אוטומטי"): the member opens a NEW Nedarim standing order with the new
// card through the same secure iframe as checkout. The webhook detects the
// replacement and alerts the team to cancel the old keva in the Nedarim
// console (Nedarim exposes no cancel API) — invisible to her.
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireCommunityAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPricing } from "@/lib/payments/pricing";
import { buildPlans } from "@/lib/payments/plans";
import { buildTransactionFields, isNedarimConfigured } from "@/lib/payments/nedarim";
import { NedarimCheckout } from "@/components/patterns/nedarim-checkout";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "החלפת כרטיס אשראי" };
export const dynamic = "force-dynamic";

export default async function ReplaceCardPage() {
  const profile = await requireCommunityAccess();
  if (profile.role !== "junior") redirect("/subscription");

  const pricing = await getPricing();
  const plansRec = buildPlans(pricing);
  const configured = isNedarimConfigured();

  let fields: Record<string, string> | null = null;
  if (configured) {
    const h = await headers();
    const host = h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const origin = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${proto}://${host}` : "");
    const callbackUrl = `${origin}/api/webhooks/payments`;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    const cityQ = qByKey.get("city");
    const cityOpts = Array.isArray(cityQ?.options)
      ? (cityQ.options as unknown as { value: string; label: string }[])
      : [];
    const cityRaw = answer("city");
    const city = cityOpts.find((o) => o.value === cityRaw)?.label ?? cityRaw;
    fields = buildTransactionFields(
      plansRec.monthly,
      {
        profileId: profile.id,
        fullName: profile.full_name,
        email: user?.email ?? "",
        phone: answer("phone"),
        idNumber: answer("id_number"),
        street: [answer("street"), answer("house_number")].filter(Boolean).join(" "),
        city,
      },
      callbackUrl
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <Link
        href="/subscription"
        className="flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-purple hover:underline w-fit"
      >
        <ArrowRight size={15} />
        חזרה למנוי שלי
      </Link>
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מנוי/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">החלפת כרטיס אשראי</h1>
        <p className="t-body-sm text-ink-700 mt-1">
          מזינים כאן את פרטי הכרטיס החדש — נפתחת הוראת קבע חדשה במקום הישנה, והישנה מבוטלת אצלנו.
          הכול מאובטח ישירות מול חברת הסליקה; פרטי הכרטיס לא עוברים דרכנו.
        </p>
      </div>

      {fields ? (
        <NedarimCheckout fields={fields} />
      ) : (
        <Alert variant="warn">מערכת התשלומים לא זמינה כרגע — נסי שוב עוד רגע.</Alert>
      )}
    </div>
  );
}
