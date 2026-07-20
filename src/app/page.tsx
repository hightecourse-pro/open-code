import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Briefcase,
  Crown,
  FileCheck2,
  GraduationCap,
  Mic,
  Users,
  Video,
} from "lucide-react";
import { Button, Logo } from "@/components/ui";
import { getPricing } from "@/lib/payments/pricing";
import { buildPlans, shekels } from "@/lib/payments/plans";

export const metadata = {
  title: "קוד פתוח — הדרך שלך להייטק מתחילה כאן",
  description: "קהילה חמה ותומכת לג'וניוריות בפיתוח — קורסים, סשנים שבועיים, משרות, מנטוריות וכלי AI.",
};

const FEATURES = [
  { icon: Users, title: "קהילה תומכת", body: "פיד, פורום וצ'אט עם מתכנתות אחרות — שאלות, התייעצויות ושיתופי ידע." },
  { icon: GraduationCap, title: "ספריית קורסים", body: "קורס פעיל אחד בכל פעם, להחלפה חודשית, עם מעקב ומשוב." },
  { icon: Video, title: "סשנים שבועיים", body: "מפגשים מקצועיים חיים — וכל ההקלטות זמינות לצפייה בכל זמן." },
  { icon: Briefcase, title: "משרות מותאמות", body: "משרות שלנו ומהשוק — מותאמות לפרופיל ולטכנולוגיות שלך." },
  { icon: Crown, title: "מנטוריות", body: "נשים מנוסות שמלוות אותך אישית — מהצעד הראשון ועד המשרה." },
  { icon: FileCheck2, title: "בודקת קורות חיים", body: "ניתוח חכם של קורות החיים שלך, עם תובנות והתאמה למשרה." },
  { icon: Mic, title: "סימולטור ראיונות", body: "תרגול ראיונות (גם קולי!) עם משוב מחזק — כדי שתגיעי בטוחה." },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  // Older auth emails land here with `?code=` (Supabase's Site-URL fallback).
  // Forward them into the callback so the link still works.
  const { code } = await searchParams;
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=/forum`);

  const pricing = await getPricing();
  const plans = buildPlans(pricing);

  return (
    <main className="min-h-full">
      {/* hero */}
      <section className="relative px-6 pt-16 pb-12 text-center">
        <div className="bg-brand-glow absolute inset-0 -z-10" />
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-6">
          <Logo width={240} priority />
          <h1 className="t-display">
            הדרך שלך להייטק <span className="t-gradient">מתחילה כאן</span>
          </h1>
          <p className="t-body-lg text-ink-700 max-w-md">
            קהילה חמה ותומכת לג&apos;וניוריות בפיתוח. אנחנו ביחד — מהצעד הראשון ועד המשרה הראשונה.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button bracketed asChild>
              <Link href="/signup">הצטרפות לקהילה</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/login">כבר רשומה? לכניסה</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* what's included */}
      <section className="px-6 py-14 bg-white border-y border-ink-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;מה מקבלים/&gt;</span>
            <h2 className="font-display text-[28px] font-black text-ink-1000 mt-1">הכול במנוי אחד</h2>
            <p className="t-body text-ink-700 mt-1">כל מה שאת צריכה כדי לפרוץ לעולם הפיתוח — במקום אחד.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-ink-50 border border-ink-200 rounded-[18px] p-5">
                  <div className="w-11 h-11 rounded-md bg-brand-gradient text-white flex items-center justify-center mb-3">
                    <Icon size={20} />
                  </div>
                  <h3 className="font-display font-bold text-ink-1000 text-[16px]">{f.title}</h3>
                  <p className="t-body-sm text-ink-700 mt-1">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* pricing */}
      <section className="px-6 py-14">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;מנוי/&gt;</span>
            <h2 className="font-display text-[28px] font-black text-ink-1000 mt-1">דמי מנוי</h2>
            <p className="t-body text-ink-700 mt-1">מחיר אחד, כל הערך. אפשר לבטל בכל עת אחרי {pricing.minTermMonths} החודשים הראשונים.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border-[1.5px] border-brand-purple rounded-[20px] p-6 shadow-glow-purple text-center">
              <div className="font-display font-bold text-ink-1000">{plans.monthly.label}</div>
              <div className="font-display font-black text-[40px] text-ink-1000 my-2" dir="ltr">
                {shekels(plans.monthly.amountAgorot)} ₪
              </div>
              <div className="t-body-sm text-ink-500">{plans.monthly.note}</div>
            </div>
            <div className="bg-white border border-ink-200 rounded-[20px] p-6 text-center">
              <div className="font-display font-bold text-ink-1000">{plans.annual.label}</div>
              <div className="font-display font-black text-[40px] text-ink-1000 my-2" dir="ltr">
                {shekels(plans.annual.amountAgorot)} ₪
              </div>
              <div className="t-body-sm text-ink-500">{plans.annual.note}</div>
            </div>
          </div>
          <div className="text-center mt-8">
            <Button bracketed asChild>
              <Link href="/signup">להצטרפות עכשיו</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-ink-500 text-sm border-t border-ink-200">
        קוד פתוח · קהילה למפתחות ג&apos;וניוריות 💜
      </footer>
    </main>
  );
}
