// The projects portal of the hackathon - for employers (the owner, 1/11): every submitted project,
// by challenge and by free-text search; each one opens to its video, its live system in the cloud,
// ״מה שמעבר לאתגר״, the technologies and one personal sentence per member. PUBLIC - no login; the
// texts are the printed booklet's, nothing judged is shown. The challenges read like the booklet.
// 2/11 (the owner): a short top - the logo, one line, two buttons - instead of the long text, and a
// numbers dashboard after the projects, before the employers' call (not at the top).
import type { Metadata } from "next";
import { Suspense } from "react";
import { CHALLENGE_ORDER, COUNTS, PROJECTS, SHOWCASE_PATH, projectsOf, topTech } from "@/lib/hackathon-showcase";
import { H26Style, HackathonFooter, HackathonLogo, Sparkle, Squiggle, Wave } from "../shared";
import { Explorer } from "./explorer";
import { Reveal } from "./reveal";
import { ChallengeCard, EmployerCta, ShowcaseStyle, TopBar } from "./showcase-ui";
import { StatsDashboard } from "./stats";

const DESCRIPTION = `${COUNTS.projects} מערכות AI עובדות שבנו ${COUNTS.people} מפתחות מקהילת קוד פתוח בשבועיים, לשלושה ארגונים אמיתיים: שטראוס, הפניקס והמעבדה המרכזית לנגיפים. לכל פרויקט - הסרטון, המערכת החיה בענן, הטכנולוגיות ומשפט אישי.`;

export const metadata: Metadata = {
  title: "הפרויקטים של האקתון AI 2026",
  description: DESCRIPTION,
  openGraph: {
    title: "הפרויקטים של האקתון AI קוד פתוח 2026",
    description: DESCRIPTION,
    images: [{ url: "/hackathon-2026/logo-hackathon.png" }],
  },
};

const TICKER_TECH = topTech(22).map((t) => t.name);

export default function ShowcasePage() {
  const tech = topTech(14);
  return (
    <main className="min-h-full bg-white text-ink-1000 overflow-x-hidden">
      <H26Style />
      <ShowcaseStyle />
      <TopBar />

      {/* ─────────────────────────────── hero ─────────────────────────────── */}
      <section className="relative px-6 pt-8 pb-8 text-center">
        <div className="bg-brand-glow absolute inset-0 -z-10" />
        <div aria-hidden className="h26-blob absolute -top-16 -left-20 w-72 h-72 bg-tint-pink/60 -z-10" />
        <div aria-hidden className="h26-blob absolute top-20 -right-24 w-80 h-80 bg-tint-purple/50 -z-10" style={{ animationDelay: "2s" }} />
        <Sparkle className="absolute top-10 right-[14%] w-6 h-6" />
        <Sparkle className="absolute top-36 left-[10%] w-4 h-4" color="#E0418D" delay="0.8s" />

        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4">
          <span className="font-mono text-xs text-brand-pink-deep">&lt;הפרויקטים/&gt;</span>
          <h1 className="w-full max-w-[380px] mx-auto">
            <HackathonLogo priority className="block w-full" />
            <span className="sr-only">הפרויקטים של האקתון AI קוד פתוח 2026</span>
          </h1>
          <p className="font-display font-black text-[25px] sm:text-[32px] leading-tight text-ink-900 max-w-2xl" data-testid="sc-headline">
            <span className="sc-grad block">{COUNTS.projects} מערכות AI עובדות.</span>
            <span className="whitespace-nowrap">{COUNTS.people} מפתחות.</span> <span className="whitespace-nowrap">{COUNTS.challenges} אתגרים אמיתיים.</span>
          </p>
          <p className="t-body text-ink-700 max-w-xl">לכל פרויקט: סרטון, מערכת חיה בענן, הטכנולוגיות ומשפט אישי של מי שבנתה אותו.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap mt-1">
            <a href="#projects" className="inline-flex items-center gap-2 rounded-full bg-brand-gradient text-white font-bold text-[16px] px-6 py-2.5 shadow-md hover:-translate-y-0.5 transition-transform">
              לפרויקטים <span className="font-mono">&lt;</span>
            </a>
            <a href="#challenges" className="inline-flex items-center gap-2 rounded-full bg-white border-[1.5px] border-brand-purple text-brand-purple font-bold text-[16px] px-6 py-2.5 shadow-sm hover:bg-tint-purple transition-colors">
              האתגרים
            </a>
          </div>
        </div>
      </section>

      {/* a ticker of the technologies they built with */}
      <div className="bg-brand-gradient py-2 overflow-hidden" dir="ltr" aria-hidden>
        <div className="h26-ticker-track flex whitespace-nowrap w-max">
          {[0, 1].map((half) => (
            <span key={half} className="font-mono font-bold text-white text-[14.5px] tracking-wide">
              {TICKER_TECH.map((t) => `${t}  ✦  `).join("").repeat(2)}
            </span>
          ))}
        </div>
      </div>

      {/* ─────────────────────────── the challenges ─────────────────────────── */}
      <section id="challenges" className="px-6 pt-12 pb-14 bg-[#FBF7FF] relative scroll-mt-14">
        <Sparkle className="absolute top-14 left-[8%] w-5 h-5" color="#E0418D" delay="0.6s" />
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-10">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;אתגרים/&gt;</span>
            <h2 className="font-display text-[30px] font-black mt-1 relative inline-block">
              שלושה אתגרים. שלוש בעיות אמיתיות מהשטח.
              <Squiggle className="absolute -bottom-3 right-4 w-32 h-3" />
            </h2>
            <p className="t-body text-ink-700 mt-3 max-w-2xl mx-auto">
              שלושה סוגים של AI: סוכן עם כלים וחישוב בקוד, קריאת מסמכים עם בקרה אנושית, ותשובות מתוך גוף ידע. כל ארגון הביא בעיה אמיתית - וכל פרויקט כאן פותר אותה בדרך שלו.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-7 items-stretch">
            {CHALLENGE_ORDER.map((k, i) => (
              <Reveal key={k} delay={i * 120} className="h-full">
                <ChallengeCard k={k} count={projectsOf(k).length} href={`${SHOWCASE_PATH}?ch=${k}#projects`} i={i} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <Wave tint="#FBF7FF" />

      {/* ─────────────────────────── the projects ─────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 pt-4 text-center">
        <span className="font-mono text-xs text-brand-pink-deep">&lt;פרויקטים/&gt;</span>
        <h2 className="font-display text-[30px] font-black mt-1">
          {COUNTS.projects} פרויקטים. כל אחד נכנס, רץ, ועובד.
        </h2>
        <p className="t-body text-ink-700 mt-1.5 mb-4">סננו לפי אתגר או טכנולוגיה, או חפשו שם ומילה חופשית.</p>
      </div>
      <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-16 text-center text-ink-500">טוענת את הפרויקטים…</div>}>
        <Explorer projects={PROJECTS} topTech={tech} />
      </Suspense>

      {/* ─────────────────────────── the numbers ─────────────────────────── */}
      {/* after the projects (the owner, 2/11: not at the top) - the summary before the employers' call */}
      <StatsDashboard />

      <Wave flip tint="#FBF7FF" />
      <div className="bg-[#FBF7FF]">
        <EmployerCta />
      </div>
      <HackathonFooter />
    </main>
  );
}
