// The second design of the projects portal (the owner, 4/11): her Claude Design canvas, rebuilt here
// as a route of its own beside /hackathon-2026/projects so the two can be compared - with her notes:
// short texts, the partners with the challenge's technology only and details on a click, a click that
// filters, the winners in one thin row above the grid. PUBLIC, not indexed while it is a comparison.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { COUNTS, PROJECTS, STATS, projectByK8, topTech } from "@/lib/hackathon-showcase";
import { Explorer } from "./explorer";
import { BTN_INK, BTN_PINK, Employers, Footer, Numbers, Quotes, StatBox, TopBar, WRAP, WinnersStrip } from "./ui";

const DESCRIPTION = `${COUNTS.projects} מערכות AI עובדות שבנו ${COUNTS.people} מפתחות מקהילת קוד פתוח בשבועיים, לשלושה ארגונים אמיתיים: שטראוס, הפניקס והמעבדה המרכזית לנגיפים. לכל פרויקט - הסרטון, המערכת החיה בענן, הטכנולוגיות ומשפט אישי.`;

export const metadata: Metadata = {
  title: "הפרויקטים של האקתון AI 2026",
  description: DESCRIPTION,
  robots: { index: false, follow: true },
  openGraph: { title: "הפרויקטים של האקתון AI קוד פתוח 2026", description: DESCRIPTION, images: [{ url: "/hackathon-2026/logo-hackathon.png" }] },
};

/** The three sentences under ״במילים שלהן״ - the booklet's quotes of יפה חבקין, אילה שמואלביץ, חוה שטרן. */
const QUOTES = [
  { k8: "1da3dbcf", i: 0 },
  { k8: "116be4f9", i: 1 },
  { k8: "45494404", i: 0 },
];

export default function ShowcasePage() {
  const quotes = QUOTES.map(({ k8, i }) => ({ p: projectByK8(k8), i })).filter((x): x is { p: NonNullable<typeof x.p>; i: number } => !!x.p);
  return (
    <main className="min-h-full bg-white text-[#1B1530] overflow-x-hidden">
      <TopBar />

      {/* hero */}
      <section className="bg-[#F7F5FB]" data-testid="sh-hero">
        <div className={`${WRAP} pt-14 pb-10 flex flex-wrap items-center gap-10`}>
          <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-5">
            <span className="inline-flex self-start items-center gap-2 rounded-full bg-white border border-[#E3DDEE] text-[13.5px] font-bold text-[#B0154B] px-3.5 py-1.5">
              <span className="w-2 h-2 rounded-full bg-[#D81B5C]" aria-hidden />
              האקתון AI קוד פתוח 2026 · הפרויקטים
            </span>
            <h1 className="text-[38px] sm:text-[56px] font-black leading-[1.05] tracking-[-0.5px]" data-testid="sh-headline">
              <span className="block">{COUNTS.projects} מערכות AI עובדות.</span>
              <span className="block">
                {COUNTS.people} מפתחות. {COUNTS.challenges} אתגרים אמיתיים.
              </span>
            </h1>
            <div className="flex flex-wrap gap-3 mt-1">
              <Link href="#projects" className={`${BTN_PINK} min-h-12 text-[16px]`}>
                לפרויקטים
              </Link>
              <Link href="#employers" className={`${BTN_INK} min-h-12 text-[16px]`}>
                למעסיקים
              </Link>
            </div>
          </div>
          <div className="flex-[1_1_300px] min-w-0 flex justify-center">
            <Image src="/hackathon-2026/logo-hackathon.png" alt="האקתון AI 2026 - לפצח את קוד הכניסה" width={1600} height={934} priority className="w-[360px] max-w-full h-auto" />
          </div>
        </div>
        <div className={`${WRAP} pb-14`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#E3DDEE] border border-[#E3DDEE] rounded-[12px] overflow-hidden" data-testid="sh-stats">
            <StatBox n={COUNTS.projects} label="פרויקטים" />
            <StatBox n={COUNTS.people} label="מפתחות" />
            <StatBox n={STATS.tech} label="טכנולוגיות" />
            <StatBox n={COUNTS.institutions ?? 0} label="מוסדות לימוד" />
          </div>
        </div>
      </section>

      <Suspense fallback={<div className={`${WRAP} py-16 text-center text-[#6B6580]`}>טוענת את הפרויקטים…</div>}>
        <Explorer projects={PROJECTS} topTech={topTech(14)} winners={<WinnersStrip />} />
      </Suspense>

      <Numbers />
      <Quotes items={quotes} />
      <div className="bg-[#F7F5FB]">
        <Employers />
      </div>
      <Footer />
    </main>
  );
}
