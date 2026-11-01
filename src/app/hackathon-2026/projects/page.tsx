// The projects portal of the hackathon - for employers (the owner, 1/11): every submitted project,
// by challenge and by free-text search; each one opens to its video, its live system in the cloud,
// ״מה שמעבר לאתגר״, the technologies and one personal sentence per member. PUBLIC - no login; the
// texts are the printed booklet's, nothing judged is shown. The challenges read like the booklet.
import type { Metadata } from "next";
import { Suspense } from "react";
import { CHALLENGE_ORDER, COUNTS, PROJECTS, SHOWCASE_PATH, projectsOf, topTech } from "@/lib/hackathon-showcase";
import { CurlyArrow, H26Style, HackathonFooter, HackathonLogo, Sparkle, Squiggle, Wave } from "../shared";
import { Explorer } from "./explorer";
import { CountUp, Reveal } from "./reveal";
import { ChallengeCard, EmployerCta, ShowcaseStyle, TopBar } from "./showcase-ui";

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
      <section className="relative px-6 pt-10 pb-12 text-center">
        <div className="bg-brand-glow absolute inset-0 -z-10" />
        <div aria-hidden className="h26-blob absolute -top-16 -left-20 w-72 h-72 bg-tint-pink/60 -z-10" />
        <div aria-hidden className="h26-blob absolute top-32 -right-24 w-80 h-80 bg-tint-purple/50 -z-10" style={{ animationDelay: "2s" }} />
        <Sparkle className="absolute top-12 right-[12%] w-6 h-6" />
        <Sparkle className="absolute top-44 left-[8%] w-4 h-4" color="#E0418D" delay="0.8s" />
        <Sparkle className="absolute bottom-16 right-[22%] w-5 h-5" color="#F0B429" delay="1.5s" />
        <span aria-hidden className="h26-float absolute top-12 right-[5%] font-mono text-[15.5px] text-brand-pink-deep/60 rotate-6 select-none hidden md:block">
          {"projects.map(open)"}
        </span>
        <span aria-hidden className="h26-float absolute top-40 left-[5%] font-mono text-[15.5px] text-brand-purple/60 -rotate-12 select-none hidden md:block" style={{ animationDelay: "1.2s" }}>
          {"agent.solve(realProblem)"}
        </span>
        <span aria-hidden className="h26-float absolute bottom-20 left-[9%] font-mono text-[15px] text-brand-pink-deep/50 rotate-12 select-none hidden lg:block" style={{ animationDelay: "1.8s" }}>
          {"deploy(\"cloud\") // ✨"}
        </span>
        <span aria-hidden className="h26-float absolute bottom-28 right-[7%] font-mono text-[15px] text-[#B48A0A]/60 -rotate-3 select-none hidden lg:block" style={{ animationDelay: "2.4s" }}>
          {"built in 2 weeks 🏆"}
        </span>

        <div className="max-w-3xl mx-auto flex flex-col items-center gap-4">
          <span className="font-mono text-xs text-brand-pink-deep rotate-1">&lt;הפרויקטים/&gt;</span>
          <h1 className="w-full max-w-[400px] mx-auto">
            <HackathonLogo priority className="block w-full" />
            <span className="sr-only">הפרויקטים של האקתון AI קוד פתוח 2026</span>
          </h1>
          <p className="font-display font-black text-[26px] sm:text-[34px] leading-tight text-ink-900 max-w-2xl" style={{ textWrap: "balance" }}>
            <span className="sc-grad">{COUNTS.projects} מערכות AI עובדות.</span> {COUNTS.people} מפתחות. שלושה אתגרים אמיתיים.
          </p>
          <p className="t-body-lg text-ink-700 max-w-2xl">
            במשך שבועיים בנו מתכנתות מקהילת קוד פתוח מערכות AI עובדות, בענן, לשלושה ארגונים אמיתיים שהביאו בעיה אמיתית. לא תרגיל: מוצר שאפשר להיכנס אליו, להריץ, ולראות מה הוא עושה.
            <span className="block mt-1 font-bold text-ink-900">לכל פרויקט - הסרטון, המערכת החיה, מה שמעבר לאתגר, הטכנולוגיות, ומשפט אחד מכל מי שבנתה אותו.</span>
          </p>

          <div className="grid grid-cols-3 gap-3 sm:gap-5 w-full max-w-xl mt-2" data-testid="sc-stats">
            {[
              { n: COUNTS.projects, label: "פרויקטים שהוגשו", tilt: "-rotate-2" },
              { n: COUNTS.people, label: "משתתפות", tilt: "rotate-1" },
              { n: COUNTS.challenges, label: "אתגרים · 3 שותפים", tilt: "-rotate-1" },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`${s.tilt} bg-white border-2 border-ink-900/10 shadow-[4px_5px_0_0_#F3C6DD] px-3 py-4 flex flex-col items-center gap-0.5 hover:rotate-0 transition-transform`}
                style={{ borderRadius: ["22px 26px 20px 28px", "26px 20px 28px 22px", "20px 28px 22px 26px"][i] }}
              >
                <CountUp to={s.n} className="font-display font-black text-[34px] sm:text-[40px] leading-none text-brand-purple" />
                <span className="text-[13px] sm:text-[14px] text-ink-500 font-semibold text-center">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-center mt-1">
            <span className="h26-bounce -rotate-2 bg-ink-1000 text-white px-3.5 py-1.5 rounded-full text-[15px] font-bold shadow-md">למעסיקים ולשותפים</span>
            <span className="h26-bounce rotate-1 bg-brand-gradient text-white px-3.5 py-1.5 rounded-full text-[15px] font-bold shadow-md" style={{ animationDelay: "0.4s" }}>
              שטראוס · הפניקס · המעבדה המרכזית לנגיפים
            </span>
            <span className="h26-bounce -rotate-1 bg-white border-[1.5px] border-brand-purple text-brand-purple px-3.5 py-1.5 rounded-full text-[15px] font-bold shadow-md" style={{ animationDelay: "0.8s" }}>
              🏆 ערב הגמר · 28.10.2026 · היכל התרבות רמות, ירושלים
            </span>
          </div>
          <div className="flex items-start gap-1 mt-1">
            <span className="font-display font-bold text-[17px] text-brand-pink-deep rotate-6 mt-1">האתגרים והפרויקטים כאן למטה</span>
            <CurlyArrow className="h26-float w-14 h-16" />
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
            <h2 className="font-display text-[30px] font-black mt-1 -rotate-1 relative inline-block">
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
        <h2 className="font-display text-[30px] font-black mt-1 rotate-1">
          {COUNTS.projects} פרויקטים. כל אחד נכנס, רץ, ועובד.
        </h2>
        <p className="t-body text-ink-700 mt-1.5 mb-4">סננו לפי אתגר או טכנולוגיה, או חפשו שם ומילה חופשית. לחיצה על פרויקט פותחת את הסרטון, המערכת החיה והסיפור שלו.</p>
      </div>
      <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-16 text-center text-ink-500">טוענת את הפרויקטים…</div>}>
        <Explorer projects={PROJECTS} topTech={tech} />
      </Suspense>

      <Wave flip tint="#FBF7FF" />
      <div className="bg-[#FBF7FF]">
        <EmployerCta />
      </div>
      <HackathonFooter />
    </main>
  );
}
