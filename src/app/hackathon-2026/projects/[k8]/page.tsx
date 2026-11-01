// One project of the portal (the owner, 1/11): the video, the live system in the cloud, ״מה שמעבר
// לאתגר״, the technologies and a personal sentence of each member - then the challenge as the
// booklet tells it, and the neighbours of the same challenge. Statically generated for the 60.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CHALLENGE_INFO, PROJECTS, SHOWCASE_PATH, projectByK8, projectsOf, teamName } from "@/lib/hackathon-showcase";
import { H26Style, HackathonFooter, Sparkle, Squiggle } from "../../shared";
import { Reveal } from "../reveal";
import { ChallengeCard, EmployerCta, ProjectCard, ShowcaseStyle, TechChip, TopBar } from "../showcase-ui";
import { ProjectHero } from "./project-hero";

export const dynamicParams = false;

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ k8: p.k8 }));
}

export async function generateMetadata({ params }: { params: Promise<{ k8: string }> }): Promise<Metadata> {
  const { k8 } = await params;
  const p = projectByK8(k8);
  if (!p) return {};
  const title = `${teamName(p)} · ${CHALLENGE_INFO[p.challenge].title}`;
  return {
    title,
    description: p.blurb,
    openGraph: { title: `${title} · האקתון AI קוד פתוח 2026`, description: p.blurb, images: p.image ? [{ url: p.image }] : undefined },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ k8: string }> }) {
  const { k8 } = await params;
  const p = projectByK8(k8);
  if (!p) notFound();
  const c = CHALLENGE_INFO[p.challenge];
  const siblings = projectsOf(p.challenge);
  const idx = siblings.findIndex((s) => s.k8 === p.k8);
  const prev = siblings[(idx - 1 + siblings.length) % siblings.length];
  const next = siblings[(idx + 1) % siblings.length];
  const more = [1, 2, 3].map((d) => siblings[(idx + d) % siblings.length]).filter((s) => s.k8 !== p.k8);

  return (
    <main className="min-h-full bg-white text-ink-1000 overflow-x-hidden">
      <H26Style />
      <ShowcaseStyle />
      <TopBar onProjectPage />

      <article className="relative px-6 pt-8 pb-12">
        <div className="bg-brand-glow absolute inset-0 -z-10 opacity-70" />
        <div aria-hidden className="h26-blob absolute -top-10 -right-24 w-72 h-72 bg-tint-purple/40 -z-10" />
        <Sparkle className="absolute top-10 left-[6%] w-5 h-5" color="#E0418D" delay="0.5s" />
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          <nav className="flex items-center gap-2 text-[14px] text-ink-500 flex-wrap" aria-label="ניווט">
            <Link href={SHOWCASE_PATH} className="font-bold text-brand-pink-deep hover:underline">
              כל הפרויקטים
            </Link>
            <span className="font-mono">&lt;</span>
            <Link href={`${SHOWCASE_PATH}?ch=${p.challenge}#projects`} className="font-bold text-ink-700 hover:underline">
              {c.emoji} {c.short}
            </Link>
            <span className="font-mono">&lt;</span>
            <span className="text-ink-900">{teamName(p)}</span>
          </nav>

          <ProjectHero p={p} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-start">
            <Reveal>
              <section className="bg-white border-2 border-ink-900/10 shadow-[5px_6px_0_0_#EDE4F7] p-6 rotate-[0.6deg] hover:rotate-0 transition-transform" style={{ borderRadius: "20px 28px 22px 26px" }} data-testid="sc-tech-section">
                <span className="font-mono text-xs text-brand-pink-deep">&lt;טכנולוגיות/&gt;</span>
                <h2 className="font-display font-black text-[22px] mt-1 text-ink-900">הטכנולוגיות שבנו איתן</h2>
                <p className="text-[14px] text-ink-500 mt-0.5">לחיצה על טכנולוגיה מציגה את כל הפרויקטים שנבנו איתה.</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {p.tech.map((t) => (
                    <TechChip key={t} name={t} href={`${SHOWCASE_PATH}?t=${encodeURIComponent(t)}#projects`} />
                  ))}
                  {!p.tech.length && <span className="text-ink-500 text-[14.5px]">הצוות לא פירט טכנולוגיות.</span>}
                </div>
              </section>
            </Reveal>

            <Reveal delay={100}>
              <section className="bg-[#FFF4F8] border-2 border-brand-pink/30 shadow-[5px_6px_0_0_#F3C6DD] p-6 -rotate-[0.6deg] hover:rotate-0 transition-transform" style={{ borderRadius: "26px 20px 28px 22px" }} data-testid="sc-quotes">
                <span className="font-mono text-xs text-brand-pink-deep">&lt;במילים שלהן/&gt;</span>
                <h2 className="font-display font-black text-[22px] mt-1 text-ink-900">משפט אחד מכל מי שבנתה</h2>
                <div className="flex flex-col gap-3 mt-4">
                  {p.quotes.map((q) => (
                    <blockquote key={q.id} className="border-s-4 border-brand-pink bg-white rounded-[12px] px-4 py-3 shadow-sm" data-testid="sc-quote">
                      <p className="text-[15.5px] leading-relaxed text-ink-900 italic">״{q.quote}״</p>
                      <cite className="block not-italic font-bold text-[14.5px] text-brand-purple mt-1.5">{q.name}</cite>
                    </blockquote>
                  ))}
                  {p.members
                    .filter((m) => !p.quotes.some((q) => q.id === m.id))
                    .map((m) => (
                      <p key={m.id} className="text-[14px] text-ink-500">
                        {m.name} - בנתה יחד, בלי משפט אישי.
                      </p>
                    ))}
                </div>
              </section>
            </Reveal>
          </div>
        </div>
      </article>

      {/* the challenge, as the booklet tells it */}
      <section className="px-6 py-14 bg-[#FBF7FF] relative" data-testid="sc-project-challenge">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8 items-start">
          <Reveal>
            <span className="font-mono text-xs text-brand-pink-deep">&lt;האתגר/&gt;</span>
            <h2 className="font-display text-[28px] font-black mt-1 -rotate-1 relative inline-block text-ink-900">
              האתגר שהפרויקט הזה פותר
              <Squiggle className="absolute -bottom-3 right-2 w-28 h-3" />
            </h2>
            <p className="t-body text-ink-700 mt-4">
              {c.org} הביאו בעיה אמיתית מהשטח. {siblings.length} צוותים בחרו באתגר הזה, וכל אחד פתר אותו בדרך שלו.
            </p>
            <div className="flex items-center gap-2 mt-5 flex-wrap">
              <Link href={`${SHOWCASE_PATH}/${prev.k8}`} className="inline-flex items-center gap-1.5 rounded-full bg-white border-[1.5px] border-ink-900/10 text-ink-900 font-bold text-[14px] px-3.5 py-1.5 hover:border-brand-pink/60 transition-colors" data-testid="sc-prev">
                <span className="font-mono">&gt;</span> הפרויקט הקודם
              </Link>
              <Link href={`${SHOWCASE_PATH}/${next.k8}`} className="inline-flex items-center gap-1.5 rounded-full bg-white border-[1.5px] border-ink-900/10 text-ink-900 font-bold text-[14px] px-3.5 py-1.5 hover:border-brand-pink/60 transition-colors" data-testid="sc-next">
                הפרויקט הבא <span className="font-mono">&lt;</span>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <ChallengeCard k={p.challenge} count={siblings.length} href={`${SHOWCASE_PATH}?ch=${p.challenge}#projects`} i={1} />
          </Reveal>
        </div>
      </section>

      {more.length > 0 && (
        <section className="px-6 py-14">
          <div className="max-w-6xl mx-auto">
            <Reveal className="text-center mb-8">
              <span className="font-mono text-xs text-brand-pink-deep">&lt;עוד/&gt;</span>
              <h2 className="font-display text-[26px] font-black mt-1 rotate-1 text-ink-900">עוד פרויקטים באתגר של {c.short}</h2>
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="sc-more">
              {more.map((s, i) => (
                <Reveal key={s.k8} delay={i * 90} className="h-full">
                  <ProjectCard p={s} i={i} />
                </Reveal>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href={`${SHOWCASE_PATH}?ch=${p.challenge}#projects`} className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient text-white font-bold text-[15.5px] px-5 py-2.5 shadow-md hover:-translate-y-0.5 transition-transform">
                כל {siblings.length} הפרויקטים של {c.short} <span className="font-mono">&lt;</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="bg-[#FBF7FF]">
        <EmployerCta />
      </div>
      <HackathonFooter />
    </main>
  );
}
