// The pieces of the projects portal that need no browser state: the page style, the top bar,
// the challenge card (the booklet's divider page), the project card, the technology chip, the
// employers' call. Same visual language as the event page (shared.tsx): the logo's pink-to-indigo
// gradient, hand-drawn doodles, tilted cards with a hard offset shadow, mono code eyebrows.
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { Fragment } from "react";
import { CHALLENGE_INFO, SHOWCASE_PATH, awardOf, finalsOf, hasStream, teamName, type ChallengeKey, type ShowcaseProject } from "@/lib/hackathon-showcase";
import { CHALLENGES, Sparkle } from "../shared";

/** Portal-only motion: scroll reveal, gradient shimmer on the headline, card hover, the play pulse. */
export function ShowcaseStyle() {
  return (
    <>
      <style>{`
        .sc-reveal { opacity: 0; }
        .sc-reveal.in { animation: sc-rise .75s cubic-bezier(.2,.8,.2,1) var(--d, 0ms) both; }
        @keyframes sc-rise { from { opacity: 0; transform: translateY(22px) scale(.985); } to { opacity: 1; transform: none; } }
        @keyframes sc-shine { to { background-position: 220% center; } }
        .sc-grad { background: linear-gradient(95deg, #E0418D 0%, #913F80 30%, #464CA0 55%, #913F80 80%, #E0418D 100%); background-size: 220% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: sc-shine 8s linear infinite; }
        .sc-card { transition: transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s cubic-bezier(.2,.8,.2,1), rotate .35s cubic-bezier(.2,.8,.2,1); }
        .sc-card:hover, .sc-card:focus-visible { transform: translateY(-6px); box-shadow: 8px 10px 0 0 #E0418D; }
        .sc-card img { transition: transform .7s cubic-bezier(.2,.8,.2,1); }
        .sc-card:hover img { transform: scale(1.05); }
        @keyframes sc-pulse { 0%, 100% { box-shadow: 0 10px 30px rgba(17,16,42,.35), 0 0 0 0 rgba(224,65,141,.55); } 60% { box-shadow: 0 10px 30px rgba(17,16,42,.35), 0 0 0 18px rgba(224,65,141,0); } }
        .sc-play { animation: sc-pulse 2.4s ease-out infinite; }
        @keyframes sc-pop { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: none; } }
        .sc-pop { animation: sc-pop .4s cubic-bezier(.2,.8,.2,1) both; }
        .sc-chip { transition: transform .2s cubic-bezier(.34,1.56,.64,1), background-color .2s, color .2s, border-color .2s; }
        .sc-chip:hover { transform: translateY(-2px) rotate(-1.5deg); }
        .sc-chip[data-on="1"] { transform: scale(1.04); }
        .sc-num { background: linear-gradient(95deg, #E0418D 0%, #913F80 50%, #464CA0 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .sc-bar { width: 0; transition: width 1.1s cubic-bezier(.2,.8,.2,1) var(--d, 0ms); }
        .sc-reveal.in .sc-bar { width: var(--w); }
        @media (prefers-reduced-motion: reduce) {
          .sc-reveal { opacity: 1; }
          .sc-reveal.in, .sc-grad, .sc-play, .sc-pop { animation: none !important; }
          .sc-card, .sc-card img, .sc-chip, .sc-bar { transition: none; }
          .sc-bar { width: var(--w); }
        }
      `}</style>
      <noscript>
        <style>{`.sc-reveal { opacity: 1; } .sc-bar { width: var(--w); }`}</style>
      </noscript>
    </>
  );
}

/** Sticky top bar: the community's logo home, the hackathon's logo to the portal's top, three anchors. */
export function TopBar({ onProjectPage = false }: { onProjectPage?: boolean }) {
  const anchor = (hash: string) => (onProjectPage ? `${SHOWCASE_PATH}#${hash}` : `#${hash}`);
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-ink-100" data-testid="sc-topbar">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3 sm:gap-5">
        <Link href="/" className="shrink-0" aria-label="קהילת קוד פתוח">
          <Logo width={104} />
        </Link>
        <Link href={SHOWCASE_PATH} className="shrink-0 hidden sm:block" aria-label="הפרויקטים של האקתון AI 2026">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/live/hackathon-color.png" alt="האקתון AI 2026" className="h-9 w-auto" />
        </Link>
        <nav className="ms-auto flex items-center gap-0.5 sm:gap-1 text-[14px] sm:text-[14.5px] font-bold text-ink-700">
          <Link href={anchor("challenges")} className="px-2.5 py-1.5 rounded-full hover:bg-tint-pink hover:text-brand-pink-deep transition-colors">
            האתגרים
          </Link>
          <Link href={anchor("projects")} className="px-2.5 py-1.5 rounded-full hover:bg-tint-pink hover:text-brand-pink-deep transition-colors">
            הפרויקטים
          </Link>
          <Link href={anchor("numbers")} className="px-2.5 py-1.5 rounded-full hover:bg-tint-pink hover:text-brand-pink-deep transition-colors hidden sm:block">
            במספרים
          </Link>
          <Link href={anchor("employers")} className="px-3 py-1.5 rounded-full bg-brand-gradient text-white shadow-sm hover:-translate-y-0.5 transition-transform">
            למעסיקים
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function ChallengeBadge({ k, className = "" }: { k: ChallengeKey; className?: string }) {
  const c = CHALLENGE_INFO[k];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-white/95 border border-ink-900/10 text-ink-900 text-[12.5px] font-bold px-2.5 py-0.5 shadow-sm ${className}`} data-testid="sc-badge" data-ch={k}>
      {c.short}
    </span>
  );
}

/** The finals of 28.10: ״זוכת האתגר״ (gradient) or ״עלתה לגמר״ (outlined); nothing for the other projects. */
export function AwardBadge({ p, className = "", large = false }: { p: ShowcaseProject; className?: string; large?: boolean }) {
  const a = awardOf(p);
  if (!a) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold shadow-sm whitespace-nowrap ${large ? "text-[13.5px] px-3 py-1" : "text-[12.5px] px-2.5 py-0.5"} ${
        a.kind === "winner" ? "bg-brand-gradient text-white" : "bg-white/95 text-brand-purple border border-brand-purple/50"
      } ${className}`}
      data-testid="sc-award"
      data-award={a.kind}
    >
      {a.label}
    </span>
  );
}

/** A technology chip - a link into the portal filtered by it, or a plain label. */
export function TechChip({ name, href, on = false, count, small = false }: { name: string; href?: string; on?: boolean; count?: number; small?: boolean }) {
  const cls = `sc-chip inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap ${small ? "text-[12.5px] px-2 py-0.5" : "text-[13.5px] px-3 py-1"} ${
    on ? "bg-brand-purple text-white border-brand-purple" : "bg-tint-purple/70 text-brand-purple border-transparent hover:border-brand-purple/40"
  }`;
  const body = (
    <>
      <span dir="ltr">{name}</span>
      {typeof count === "number" && <span className={`font-mono text-[11px] ${on ? "text-white/80" : "text-brand-purple/60"}`}>{count}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={cls} data-on={on ? "1" : "0"} data-testid="sc-tech">
      {body}
    </Link>
  ) : (
    <span className={cls} data-on={on ? "1" : "0"} data-testid="sc-tech">
      {body}
    </span>
  );
}

const RADII = ["22px 26px 20px 28px", "26px 20px 28px 22px", "20px 28px 22px 26px"];
const TILTS = ["-rotate-1", "rotate-1", "rotate-0"];

/** One project in the grid - the whole card is the link to the project's page. */
export function ProjectCard({ p, i = 0, eager = false }: { p: ShowcaseProject; i?: number; eager?: boolean }) {
  const title = teamName(p);
  return (
    <Link
      href={`${SHOWCASE_PATH}/${p.k8}`}
      className={`sc-card group flex flex-col h-full bg-white border-2 border-ink-900/10 shadow-[5px_6px_0_0_#F3C6DD] overflow-hidden ${TILTS[i % 3]} hover:rotate-0 focus-visible:rotate-0 outline-none focus-visible:ring-4 focus-visible:ring-brand-pink/40`}
      style={{ borderRadius: RADII[i % 3] }}
      data-testid="sc-card"
      data-k8={p.k8}
      data-ch={p.challenge}
    >
      <span className="relative block aspect-[16/9] bg-tint-purple/40 overflow-hidden">
        {p.image && (
          <Image
            src={p.image}
            alt={p.caption ?? title}
            fill
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
            className="object-cover object-top"
            priority={eager}
          />
        )}
        <ChallengeBadge k={p.challenge} className="absolute top-3 right-3" />
        <AwardBadge p={p} className="absolute top-3 left-3" />
        {hasStream(p) && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-ink-1000/80 text-white text-[12px] font-bold px-2 py-0.5">
            <span aria-hidden>▶</span> סרטון
          </span>
        )}
      </span>
      <span className="flex flex-col gap-2 p-4 flex-1">
        <span className="font-display font-black text-[19px] leading-tight text-ink-900">{title}</span>
        <span className="text-[15px] text-ink-700 leading-relaxed line-clamp-3">{p.blurb}</span>
        <span className="flex flex-wrap gap-1.5 mt-auto pt-1">
          {p.tech.slice(0, 5).map((t) => (
            <TechChip key={t} name={t} small />
          ))}
          {p.tech.length > 5 && <span className="text-[12.5px] text-ink-500 px-1 py-0.5 font-mono">+{p.tech.length - 5}</span>}
        </span>
        <span className="inline-flex items-center gap-1 text-[14px] font-bold text-brand-pink-deep group-hover:gap-2 transition-all">
          לפרויקט <span className="font-mono">&lt;</span>
        </span>
      </span>
    </Link>
  );
}

/**
 * A challenge as the booklet's divider page: the partner's logo, the title, the organisation,
 * the ״שלושה סוגים של AI״ label, the booklet paragraph, how many projects - and, folded, the
 * full brief exactly as the participants read it.
 */
export function ChallengeCard({ k, count, href, i = 0, compact = false }: { k: ChallengeKey; count: number; href: string; i?: number; compact?: boolean }) {
  const c = CHALLENGE_INFO[k];
  const brief = CHALLENGES.find((x) => x.key === k);
  const finals = finalsOf(k);
  return (
    <article
      className={`relative ${c.tint} border-2 border-ink-900/10 p-6 flex flex-col gap-3`}
      style={{ borderRadius: RADII[i % 3], boxShadow: `5px 6px 0 0 ${c.shadow}` }}
      data-testid="sc-challenge"
      data-ch={k}
    >
      <Sparkle className="absolute -top-3 -left-2 w-6 h-6" color={i % 2 ? "#E0418D" : "#8B5CF6"} delay={`${i * 0.5}s`} />
      <div className="flex items-center gap-3 flex-wrap">
        {c.logos.map((l) => (
          <span key={l} className="bg-white border border-ink-100 rounded-[14px] px-3 py-2 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={l} alt="" className="h-10 w-auto max-w-[140px] object-contain" />
          </span>
        ))}
      </div>
      <div>
        <h3 className="font-display font-black text-[23px] leading-tight text-ink-900">{c.title}</h3>
        <p className="text-[14.5px] text-ink-500 mt-0.5">{c.org}</p>
      </div>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ink-1000 text-white text-[13px] font-bold px-3 py-1 -rotate-1">
        {c.pattern}
      </span>
      <p className="t-body text-ink-900 leading-relaxed">{c.blurb}</p>
      {!compact && brief?.challenge && (
        <details className="group/brief">
          <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 text-[14.5px] font-bold text-brand-purple [&::-webkit-details-marker]:hidden">
            <span className="group-open/brief:hidden">לקריאת האתגר המלא, כפי שהוצג למשתתפות</span>
            <span className="hidden group-open/brief:inline">לסגירת האתגר המלא</span>
            <span className="font-mono group-open/brief:rotate-90 transition-transform">&gt;</span>
          </summary>
          <div className="mt-3 flex flex-col gap-2 bg-white/80 border border-ink-100 rounded-[16px] p-4" data-testid="sc-brief">
            <div className="font-display font-black text-[14.5px] text-brand-pink-deep">האתגר</div>
            <p className="text-[15px] text-ink-900 leading-relaxed">{brief.challenge}</p>
            {brief.details?.length ? (
              <ul className="list-disc ps-5 text-[14.5px] text-ink-700 leading-relaxed flex flex-col gap-1">
                {brief.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>
      )}
      {finals.winner && (
        <div className="bg-white/80 border border-ink-100 rounded-[16px] px-4 py-3 text-[14px] text-ink-900 flex flex-col gap-1" data-testid="sc-challenge-finals">
          <div>
            <span className="font-black text-brand-pink-deep">זוכת האתגר: </span>
            <Link href={`${SHOWCASE_PATH}/${finals.winner.k8}`} className="font-bold hover:underline">
              {teamName(finals.winner)}
            </Link>
          </div>
          {finals.finalists.length > 0 && (
            <div className="text-ink-700">
              <span className="font-bold">עלו לגמר: </span>
              {finals.finalists.map((f, i) => (
                <Fragment key={f.k8}>
                  {i > 0 && " · "}
                  <Link href={`${SHOWCASE_PATH}/${f.k8}`} className="hover:underline">
                    {teamName(f)}
                  </Link>
                </Fragment>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 mt-auto pt-1">
        <span className="font-display font-black text-[17px] text-brand-pink-deep whitespace-nowrap" data-testid="sc-challenge-count">
          {count} פרויקטים
        </span>
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 rounded-full bg-white border-[1.5px] border-brand-pink/60 text-brand-pink-deep font-bold text-[14px] px-3.5 py-1.5 hover:bg-brand-purple hover:text-white hover:border-brand-purple transition-colors"
          data-testid="sc-challenge-link"
        >
          לפרויקטים <span className="font-mono">&lt;</span>
        </Link>
      </div>
    </article>
  );
}

/** The employers' call - the reason the portal exists. */
export function EmployerCta() {
  return (
    <section id="employers" className="px-6 py-16 relative scroll-mt-16">
      <Sparkle className="absolute top-10 right-[10%] w-5 h-5" color="#E0418D" delay="0.4s" />
      <Sparkle className="absolute bottom-12 left-[12%] w-6 h-6" delay="1.1s" />
      <div className="max-w-3xl mx-auto bg-brand-gradient text-white p-8 sm:p-10 text-center relative overflow-hidden rotate-[-0.5deg]" style={{ borderRadius: "28px 22px 30px 24px" }} data-testid="sc-employers">
        <span aria-hidden className="h26-blob absolute -top-10 -right-10 w-44 h-44 bg-white/10" />
        <span aria-hidden className="h26-blob absolute -bottom-12 -left-8 w-52 h-52 bg-white/10" style={{ animationDelay: "3s" }} />
        <h2 className="font-display font-black text-[28px] sm:text-[32px] leading-tight">מחפשים מפתחת AI לצוות שלכם?</h2>
        <p className="t-body-lg text-white/90 mt-3 max-w-xl mx-auto">
          כל פרויקט כאן נבנה בשבוע, על בעיה אמיתית של ארגון אמיתי, ועלה לענן. מי שבנתה אותו - בוגרת מסלול פיתוח, חברה בקהילת קוד פתוח, ומחפשת את הצוות הבא שלה.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap mt-6">
          <a
            href="mailto:office@opencode.org.il?subject=%D7%94%D7%A4%D7%A8%D7%95%D7%99%D7%A7%D7%98%D7%99%D7%9D%20%D7%A9%D7%9C%20%D7%94%D7%90%D7%A7%D7%AA%D7%95%D7%9F"
            className="inline-flex items-center gap-2 rounded-full bg-white text-brand-pink-deep font-bold text-[16px] px-5 py-2.5 shadow-md hover:-translate-y-0.5 transition-transform"
          >
            דברו איתנו · office@opencode.org.il
          </a>
          <Link href="/portal" className="inline-flex items-center gap-2 rounded-full border-2 border-white/80 text-white font-bold text-[16px] px-5 py-2.5 hover:bg-white/15 transition-colors">
            לפורטל המעסיקים <span className="font-mono">&lt;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
