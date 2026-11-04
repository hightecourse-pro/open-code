// The second design of the projects portal (the owner, 4/11): her Claude Design canvas, rebuilt here
// as a route of its own beside /hackathon-2026/projects so the two can be compared - with her notes:
// short texts, the partners with the challenge's technology only and details on a click, a click that
// filters, the winners in one thin row. The canvas's order and rhythm: hero (tinted) → the partners →
// how it worked → the winners → the projects → the numbers (tinted) → the employers → footer.
// PUBLIC, not indexed while it is a comparison.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { COUNTS, PROJECTS, STATS, projectByK8, topTech } from "@/lib/hackathon-showcase";
import { Explorer } from "./explorer";
import { BTN_INK, BTN_PINK, Employers, Footer, HowItWorked, Numbers, StatBox, TopBar, WRAP, WinnersStrip } from "./ui";

const DESCRIPTION = `${COUNTS.projects} מערכות AI עובדות שבנו ${COUNTS.people} מפתחות מקהילת קוד פתוח בשבועיים, לשלושה ארגונים אמיתיים: שטראוס, הפניקס והמעבדה המרכזית לנגיפים. לכל פרויקט - הסרטון, המערכת החיה בענן, הטכנולוגיות ומשפט אישי.`;

export const metadata: Metadata = {
  title: "הפרויקטים של האקתון AI 2026",
  description: DESCRIPTION,
  robots: { index: false, follow: true },
  openGraph: { title: "הפרויקטים של האקתון AI קוד פתוח 2026", description: DESCRIPTION, images: [{ url: "/hackathon-2026/logo-hackathon.png" }] },
};

/** The sentence in the numbers band - יפה חבקין's, from the booklet. */
const QUOTE_K8 = "1da3dbcf";

export default function ShowcasePage() {
  return (
    <main className="min-h-full bg-white text-[#1B1530] overflow-x-hidden">
      <TopBar />

      {/* hero - the canvas's tinted top: the badge, the two-line headline, two buttons, the logo; then the stats strip */}
      <section className="bg-[#F7F5FB]" data-testid="sh-hero">
        <div className={`${WRAP} pt-18 pb-16 flex flex-wrap items-center gap-12`}>
          <div className="flex-[999_1_520px] min-w-0 flex flex-col gap-[22px]">
            <span className="inline-flex self-start items-center gap-2 rounded-full bg-white border border-[#E3DDEE] text-[14px] font-bold text-[#B0154B] px-3.5 py-1.5">
              <span className="w-2 h-2 rounded-full bg-[#D81B5C]" aria-hidden />
              האקתון AI קוד פתוח 2026 · הפרויקטים
            </span>
            <h1 className="text-[40px] sm:text-[60px] font-black leading-[1.05] tracking-[-0.5px]" data-testid="sh-headline">
              <span className="block">{COUNTS.projects} מערכות AI עובדות.</span>
              <span className="block">
                {COUNTS.people} מפתחות. {COUNTS.challenges} אתגרים אמיתיים.
              </span>
            </h1>
            <div className="flex flex-wrap gap-3">
              <Link href="#projects" className={BTN_PINK}>
                לפרויקטים
              </Link>
              <Link href="#employers" className={BTN_INK}>
                למעסיקים
              </Link>
            </div>
          </div>
          <div className="flex-[1_1_340px] min-w-0 flex justify-center">
            <Image src="/hackathon-2026/logo-hackathon.png" alt="האקתון AI 2026 - לפצח את קוד הכניסה" width={1600} height={934} priority className="w-[360px] max-w-full h-auto" />
          </div>
        </div>
        <div className={`${WRAP} pb-16`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#E3DDEE] border border-[#E3DDEE] rounded-[12px] overflow-hidden" data-testid="sh-stats">
            <StatBox n={COUNTS.projects} label="פרויקטים" />
            <StatBox n={COUNTS.people} label="מפתחות" />
            <StatBox n={STATS.tech} label="טכנולוגיות" />
            <StatBox n={COUNTS.institutions ?? 0} label="מוסדות לימוד" />
          </div>
        </div>
      </section>

      <Suspense fallback={<div className={`${WRAP} py-16 text-center text-[#6B6580]`}>טוענת את הפרויקטים…</div>}>
        <Explorer
          projects={PROJECTS}
          topTech={topTech(14)}
          between={
            <>
              <HowItWorked />
              <WinnersStrip />
            </>
          }
        />
      </Suspense>

      <Numbers quote={projectByK8(QUOTE_K8)} />
      <Employers />
      <Footer />
    </main>
  );
}
