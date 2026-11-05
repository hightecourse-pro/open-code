// One project in the second design (the owner, 4/11: ״בכניסה לפרויקט נשאר העיצוב הישן״): the stage
// with the video, ״מה שמעבר לאתגר״, the technologies (a click filters the grid), one sentence from
// each member, the partner's details as on the portal, the neighbours of the same challenge - in the
// canvas's rhythm (the same heading block, the same cards). Statically generated for the 60.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CHALLENGE_INFO, PROJECTS, SHOWCASE2_PATH as BASE, projectByK8, projectsOf, teamName } from "@/lib/hackathon-showcase";
import { BTN_INK, CompanyDetails, Employers, Footer, ProjectCard, SectionHead, Tech, TopBar, WRAP } from "../ui";
import { ProjectStage } from "./hero";

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
    robots: { index: false, follow: true },
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
  const filtered = `${BASE}?ch=${p.challenge}#projects`;

  return (
    <main className="min-h-full bg-white text-[#1B1530] overflow-x-hidden">
      <TopBar onProjectPage />

      <article className={`${WRAP} pt-10 pb-16 flex flex-col gap-10`}>
        <nav className="flex items-center gap-2 text-[14px] text-[#6B6580] flex-wrap" aria-label="ניווט">
          <Link href={BASE} className="font-bold text-[#B0154B] hover:underline">
            כל הפרויקטים
          </Link>
          <span aria-hidden>‹</span>
          <Link href={filtered} className="font-bold text-[#4E4862] hover:underline">
            {c.short}
          </Link>
          <span aria-hidden>‹</span>
          <span className="text-[#1B1530]">{teamName(p)}</span>
        </nav>

        <ProjectStage p={p} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <section className="rounded-[12px] border border-[#ECE8F2] p-7 flex flex-col gap-3" data-testid="sh-tech-section">
            <h2 className="text-[20px] font-bold text-[#1B1530]">הטכנולוגיות</h2>
            <div className="flex flex-wrap gap-2">
              {p.tech.map((t) => (
                <Tech key={t} name={t} href={`${BASE}?t=${encodeURIComponent(t)}#projects`} />
              ))}
              {!p.tech.length && <span className="text-[#6B6580] text-[15px]">הצוות לא פירט טכנולוגיות.</span>}
            </div>
          </section>
          <section className="rounded-[12px] border border-[#ECE8F2] p-7 flex flex-col gap-3" data-testid="sh-quotes">
            <h2 className="text-[20px] font-bold text-[#1B1530]">משפט אחד מכל מי שבנתה</h2>
            <div className="flex flex-col gap-3">
              {p.quotes.map((q) => (
                <blockquote key={q.id} className="m-0 bg-[#F7F5FB] rounded-[10px] px-5 py-4" data-testid="sh-quote">
                  <p className="text-[16px] leading-relaxed text-[#1B1530]">״{q.quote}״</p>
                  <cite className="block not-italic font-bold text-[14px] text-[#4A4EA3] mt-1.5">{q.name}</cite>
                </blockquote>
              ))}
              {p.members
                .filter((m) => !p.quotes.some((q) => q.id === m.id))
                .map((m) => (
                  <p key={m.id} className="text-[14px] text-[#6B6580]">
                    {m.name} - בנתה יחד, בלי משפט אישי.
                  </p>
                ))}
            </div>
          </section>
        </div>
      </article>

      {/* the partner and its challenge - the tinted band */}
      <section className="bg-[#F7F5FB]" data-testid="sh-project-challenge">
        <div className={`${WRAP} py-22 flex flex-col gap-9`}>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <SectionHead
              eyebrow="האתגר"
              title={c.short}
              line={
                <span dir="ltr" className="inline-block font-bold text-[#1B1530]" data-testid="sh-company-tech">
                  {c.techLabel}
                </span>
              }
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`${BASE}/${prev.k8}`} className={`${BTN_INK} min-h-11 px-5 text-[15px]`} data-testid="sh-prev">
                › הקודם
              </Link>
              <Link href={`${BASE}/${next.k8}`} className={`${BTN_INK} min-h-11 px-5 text-[15px]`} data-testid="sh-next">
                הבא ‹
              </Link>
            </div>
          </div>
          <CompanyDetails k={p.challenge} href={filtered} className="bg-white border border-[#E3DDEE]" />
        </div>
      </section>

      {more.length > 0 && (
        <section className={`${WRAP} pt-14 pb-22 flex flex-col gap-7`}>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <SectionHead eyebrow="עוד מהאתגר" title={`עוד פרויקטים של ${c.short}`} />
            <Link href={filtered} className="text-[15px] font-bold text-[#4A4EA3] hover:text-[#1B1530]">
              כל {siblings.length} הפרויקטים ←
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="sh-more">
            {more.map((s) => (
              <ProjectCard key={s.k8} p={s} />
            ))}
          </div>
        </section>
      )}

      <Employers />
      <Footer />
    </main>
  );
}
