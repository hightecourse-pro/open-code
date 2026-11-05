// The second design of the projects portal (the owner, 4/11, from her Claude Design canvas): white
// ground, ink #1B1530, pink #D81B5C, indigo #4A4EA3, Heebo, 8-14px corners, no doodles and no tilt.
// A separate route (/hackathon-2026/showcase) beside the first one, so the two can be compared.
// Same static data, the booklet's words, nothing judged. The pieces here need no browser state.
//
// The order, since 5/11 (the owner: ״אף אחד לא יגלול למטה עד הפרויקטים״): a short numbers dashboard at
// the top, the three winners with their pictures, then every other project in small tiles with the
// filter line stuck under the top bar - the partners, ״איך זה עבד״ and the employers' call come after.
// The canvas's rhythm stays: one container (1240 + 24px gutters), one heading block in every section
// (an eyebrow of 14px, an h2 of 40px/800, an optional 18px line), cards with 1px #ECE8F2 borders and
// 12-14px corners, the tinted band on top, the dark employers' block on white.
import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Logo } from "@/components/ui";
import { CHALLENGE_INFO, CHALLENGE_ORDER, COUNTS, SHOWCASE2_PATH as BASE, STATS, awardOf, finalsOf, projectsOf, teamName, type ChallengeKey, type ShowcaseProject } from "@/lib/hackathon-showcase";
import { CHALLENGES } from "../shared";
import { CountUp } from "../projects/reveal";
import { HackathonLogo } from "./logo";

/** The partner's colour - the top rule of its card and of its details panel (the canvas's three). */
export const COLOR: Record<ChallengeKey, string> = { strauss: "#D81B5C", virology: "#4A4EA3", phoenix: "#923F84" };

export const BTN = "inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-lg font-bold text-[16px] transition-colors";
export const BTN_PINK = `${BTN} bg-[#D81B5C] text-white hover:bg-[#B0154B]`;
export const BTN_INK = `${BTN} border-[1.5px] border-[#1B1530] text-[#1B1530] hover:bg-[#1B1530] hover:text-white`;
export const BTN_GHOST = `${BTN} border border-[#5A5175] text-white hover:bg-white/10`;
export const WRAP = "max-w-[1288px] mx-auto px-6";
/** The canvas's pill: 44px tall, 999 radius, ink when on. */
export const PILL_ON = "bg-[#1B1530] text-white border-[#1B1530]";
export const PILL_OFF = "bg-white text-[#1B1530] border-[#D9D3E6] hover:border-[#1B1530]";
export const PILL = "inline-flex items-center gap-1.5 min-h-11 px-[18px] rounded-full border text-[15px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#4A4EA3] transition-colors";

/** The office mailbox, with the subject - the top bar's button and the employers' block share it. */
export const MAIL_HREF = "mailto:office@opencode.org.il?subject=%D7%94%D7%A4%D7%A8%D7%95%D7%99%D7%A7%D7%98%D7%99%D7%9D%20%D7%A9%D7%9C%20%D7%94%D7%90%D7%A7%D7%AA%D7%95%D7%9F";

/** The heading block of every section: the eyebrow, the h2, an optional line - the same sizes everywhere. */
export function SectionHead({ eyebrow, title, line, children, className = "" }: { eyebrow: string; title: ReactNode; line?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 max-w-[720px] ${className}`}>
      <span className="text-[14px] font-bold tracking-[1px] text-[#B0154B]">{eyebrow}</span>
      <h2 className="text-[30px] sm:text-[40px] font-extrabold leading-[1.15] text-[#1B1530]">{title}</h2>
      {line && <p className="text-[18px] leading-relaxed text-[#4E4862]">{line}</p>}
      {children}
    </div>
  );
}

/** Sticky top bar, as the canvas's header: the community's logo, the anchors in the page's order, the dark button. */
export function TopBar({ onProjectPage = false }: { onProjectPage?: boolean }) {
  const anchor = (hash: string) => (onProjectPage ? `${BASE}#${hash}` : `#${hash}`);
  const item = "text-[16px] font-medium text-[#1B1530] hover:text-[#4A4EA3] transition-colors";
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#ECE8F2]" data-testid="sh-topbar">
      <div className={`${WRAP} min-h-16 py-3 flex flex-wrap items-center justify-between gap-4`}>
        <Link href="/" className="shrink-0" aria-label="קהילת קוד פתוח">
          <Logo width={132} />
        </Link>
        <nav className="flex flex-wrap items-center gap-5 sm:gap-7">
          <Link href={anchor("featured")} className={item}>
            הזוכות
          </Link>
          <Link href={anchor("projects")} className={item}>
            כל הפרויקטים
          </Link>
          <Link href={anchor("challenges")} className={item}>
            האתגרים
          </Link>
        </nav>
        {/* the owner, 5/11: ״לא הבנתי מה כפתור המעסיקים אומר״ - the button says what it does */}
        <a href={MAIL_HREF} className="inline-flex items-center min-h-11 px-[22px] rounded-lg bg-[#1B1530] text-white text-[15px] font-bold hover:bg-[#2A2244] transition-colors" data-testid="sh-contact">
          מחפשים מפתחת AI? דברו איתנו
        </a>
      </div>
    </header>
  );
}

/** One of the headline figures in the dashboard (the canvas's stats strip); with `href` the box leads somewhere. */
export function StatBox({ n, label, href }: { n: number; label: string; href?: string }) {
  const inner = (
    <>
      <CountUp to={n} className="text-[40px] leading-none font-black text-[#4A4EA3]" />
      <span className="text-[15px] text-[#4E4862]">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="bg-white px-6 py-4 flex flex-col gap-1 hover:bg-[#F7F5FB] transition-colors" data-testid="sh-stat">
      {inner}
    </Link>
  ) : (
    <div className="bg-white px-6 py-4 flex flex-col gap-1" data-testid="sh-stat">
      {inner}
    </div>
  );
}

/** The three partners' marks for the dashboard - Sheba's for the virology lab (the owner, 5/11: ״במקום משרד הבריאות שים את הסמל של בית החולים שיבא״). */
const PARTNER_LOGO: Record<ChallengeKey, { src: string; width: number; height: number; alt: string }> = {
  strauss: { src: "/hackathon-2026/logo-strauss.png", width: 220, height: 151, alt: "שטראוס" },
  virology: { src: "/hackathon-2026/logo-sheba.png", width: 600, height: 301, alt: "המרכז הרפואי שיבא" },
  phoenix: { src: "/hackathon-2026/logo-phoenix.png", width: 387, height: 132, alt: "הפניקס" },
};

/**
 * The top of the page (the owner, 5/11: ״צריך בקצרה דשבורד של נתונים … כל הטקסט למעלה מיותר … צריך את
 * הלוגו של ההאקתון עם הנפשה … במקום 60 פרויקטים כתוב 3 אתגרים מהתעשיה ובמקום החלק שהורדת את 3 הסמלים של
 * האתגרים״): the jumping logo on the right; the five figures and the three partners' marks on the left - no
 * words. Tinted, as the canvas's hero. Short enough that the winners show on the first screen.
 */
export function Dashboard() {
  const s = STATS;
  return (
    <section id="numbers" className="bg-[#F7F5FB] scroll-mt-16" data-testid="sh-hero">
      <div className={`${WRAP} pt-8 pb-8 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-10 items-center`}>
        <div className="flex justify-center lg:justify-start">
          <HackathonLogo className="w-[260px] lg:w-[280px] max-w-full h-auto" />
        </div>
        <div className="flex flex-col gap-4 min-w-0">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-[#E3DDEE] border border-[#E3DDEE] rounded-[12px] overflow-hidden" data-testid="sh-stats">
            <StatBox n={COUNTS.challenges} label="אתגרים מהתעשייה" href="#challenges" />
            <StatBox n={COUNTS.people} label="מפתחות" />
            <StatBox n={s.live} label="מערכות חיות בענן" />
            <StatBox n={s.tech} label="טכנולוגיות" />
            <StatBox n={COUNTS.institutions ?? 0} label="מוסדות לימוד" />
          </div>
          {/* the three partners - a click shows that partner's projects */}
          <div className="grid grid-cols-3 gap-3" role="group" aria-label="החברות השותפות" data-testid="sh-partners">
            {CHALLENGE_ORDER.map((k) => {
              const l = PARTNER_LOGO[k];
              return (
                <Link key={k} href={`${BASE}?ch=${k}#projects`} className="flex items-center justify-center h-[84px] px-4 bg-white border border-[#E3DDEE] rounded-[12px] hover:border-[#1B1530] transition-colors" aria-label={`הפרויקטים של ${CHALLENGE_INFO[k].short}`} data-testid="sh-partner-logo" data-ch={k}>
                  <Image src={l.src} alt={l.alt} width={l.width} height={l.height} className="h-11 w-auto max-w-[80%] object-contain" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/** ״זוכת האתגר״ / ״עלתה לגמר״ - nothing for the other projects. */
export function AwardTag({ p, className = "" }: { p: ShowcaseProject; className?: string }) {
  const a = awardOf(p);
  if (!a) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full text-[12.5px] font-bold px-2.5 py-[3px] whitespace-nowrap ${a.kind === "winner" ? "bg-[#D81B5C] text-white" : "bg-white text-[#1B1530] border border-[#1B1530]"} ${className}`}
      data-testid="sh-award"
      data-award={a.kind}
    >
      {a.label}
    </span>
  );
}

/** The partner's chip on a card. */
export function ChallengeChip({ k, className = "" }: { k: ChallengeKey; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-[#EEEFFA] text-[#3B3F8F] text-[12px] font-bold px-2.5 py-[3px] ${className}`} data-testid="sh-chip" data-ch={k}>
      {CHALLENGE_INFO[k].short}
    </span>
  );
}

/** A technology: a plain label on a card, or a link into the portal filtered by it. */
export function Tech({ name, href, count }: { name: string; href?: string; count?: number }) {
  const cls = "inline-flex items-center gap-1 rounded-md bg-[#F4F2F8] text-[#4E4862] text-[12px] px-2 py-[3px] whitespace-nowrap";
  const body = (
    <>
      <span dir="ltr">{name}</span>
      {typeof count === "number" && <span className="text-[11px] text-[#6B6580]">{count}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={`${cls} hover:bg-[#1B1530] hover:text-white transition-colors`} data-testid="sh-tech">
      {body}
    </Link>
  ) : (
    <span className={cls} data-testid="sh-tech">
      {body}
    </span>
  );
}

const sized = (className: string) => (className.includes("text-[") ? "" : "text-[15px]");

/** A visible link to a project's page - the same words everywhere (the owner, 4/11: ״תן לינקים לפרויקטים בכל מקום״). */
export function ProjectLink({ p, className = "", dark = false }: { p: ShowcaseProject; className?: string; dark?: boolean }) {
  return (
    <Link href={`${BASE}/${p.k8}`} className={`inline-flex items-center gap-1 font-bold ${sized(className)} ${dark ? "text-[#F07AA3] hover:text-white" : "text-[#4A4EA3] hover:text-[#1B1530]"} ${className}`} data-testid="sh-project-link" data-k8={p.k8}>
      לפרויקט ←
    </Link>
  );
}

/** The live system in the cloud, when the project has one. */
export function LiveLink({ p, className = "" }: { p: ShowcaseProject; className?: string }) {
  if (!p.productUrl) return null;
  return (
    <a href={p.productUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 font-bold ${sized(className)} text-[#1B1530] hover:text-[#4A4EA3] ${className}`} data-testid="sh-live-link">
      מערכת חיה ↗
    </a>
  );
}

/**
 * One project in the grid - a small tile (the owner, 5/11: ״בקוביות קטנות יותר״): the picture and the
 * name lead to its page, the partner's chip, three technologies, the two links. The sentence about the
 * project waits on its page.
 */
export function ProjectCard({ p, eager = false }: { p: ShowcaseProject; eager?: boolean }) {
  const title = teamName(p);
  const href = `${BASE}/${p.k8}`;
  return (
    <article className="flex flex-col h-full bg-white border border-[#ECE8F2] rounded-[12px] overflow-hidden hover:border-[#1B1530] transition-colors" data-testid="sh-card" data-k8={p.k8} data-ch={p.challenge}>
      <Link href={href} className="relative block h-[132px] bg-[#F2EFF8] border-b border-[#ECE8F2] overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#4A4EA3]" aria-label={title} tabIndex={-1}>
        {p.image && <Image src={p.image} alt={p.caption ?? title} fill sizes="(min-width: 1280px) 300px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover object-top" priority={eager} />}
        <AwardTag p={p} className="absolute top-2 left-2" />
      </Link>
      <div className="flex flex-col gap-2 p-4 flex-1">
        <ChallengeChip k={p.challenge} className="self-start" />
        <h3 className="text-[16.5px] font-bold leading-snug text-[#1B1530]">
          <Link href={href} className="hover:text-[#4A4EA3] hover:underline underline-offset-4">
            {title}
          </Link>
        </h3>
        <div className="flex flex-wrap gap-1 flex-1 content-start">
          {p.tech.slice(0, 3).map((t) => (
            <Tech key={t} name={t} />
          ))}
          {p.tech.length > 3 && <span className="text-[11px] text-[#6B6580] px-1 py-[3px]">+{p.tech.length - 3}</span>}
        </div>
        <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[#F0EDF5]">
          <LiveLink p={p} className="text-[13.5px]" />
          <ProjectLink p={p} className="text-[13.5px]" />
        </div>
      </div>
    </article>
  );
}

/** A winner's card, kept small (the owner, 5/11): the picture, the partner's line, the name, two lines, three technologies, the links. */
function WinnerCard({ p }: { p: ShowcaseProject }) {
  const title = teamName(p);
  const href = `${BASE}/${p.k8}`;
  return (
    <article className="flex flex-col h-full bg-white border border-[#ECE8F2] rounded-[14px] overflow-hidden hover:border-[#1B1530] transition-colors" data-testid="sh-winner" data-k8={p.k8} data-ch={p.challenge}>
      <Link href={href} className="relative block h-[160px] bg-[#F2EFF8] border-b border-[#ECE8F2] overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#4A4EA3]" aria-label={title} tabIndex={-1}>
        {p.image && <Image src={p.image} alt={p.caption ?? title} fill sizes="(min-width: 768px) 420px, 100vw" className="object-cover object-top" priority />}
      </Link>
      <div className="flex flex-col gap-2 p-4 flex-1">
        <span className="text-[12.5px] font-bold" style={{ color: COLOR[p.challenge] }}>
          זוכת האתגר · {CHALLENGE_INFO[p.challenge].short}
        </span>
        <h3 className="text-[19px] font-extrabold leading-tight text-[#1B1530]">
          <Link href={href} className="hover:text-[#4A4EA3] hover:underline underline-offset-4">
            {title}
          </Link>
        </h3>
        <p className="text-[14px] text-[#4E4862] leading-relaxed line-clamp-2 flex-1">{p.blurb}</p>
        <div className="flex flex-wrap gap-1">
          {p.tech.slice(0, 3).map((t) => (
            <Tech key={t} name={t} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[#F0EDF5]">
          <LiveLink p={p} className="text-[14px]" />
          <ProjectLink p={p} className="text-[14px]" />
        </div>
      </div>
    </article>
  );
}

/** The three winners, right under the dashboard (the owner, 5/11: ״פרויקטים מנצחים״ first, with pictures). */
export function Winners() {
  return (
    <section id="featured" className={`${WRAP} pt-12 pb-2 flex flex-col gap-6 scroll-mt-16`} data-testid="sh-winners">
      <SectionHead eyebrow="הזוכות" title="שלוש זוכות, אחת לכל אתגר" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {CHALLENGE_ORDER.map((k) => {
          const w = finalsOf(k).winner;
          return w ? <WinnerCard key={k} p={w} /> : null;
        })}
      </div>
    </section>
  );
}

/**
 * What opens under a partner's card on a click (the owner, 4/11: ״רק בלחיצה נפתח פרטים״): the
 * booklet's title and paragraph, the winner and the finalists, the full brief folded, and the way
 * into the filtered grid.
 */
export function CompanyDetails({ k, href = "#projects", className = "bg-[#F7F5FB]" }: { k: ChallengeKey; href?: string; className?: string }) {
  const c = CHALLENGE_INFO[k];
  const brief = CHALLENGES.find((x) => x.key === k);
  const finals = finalsOf(k);
  const count = projectsOf(k).length;
  return (
    <div className={`${className} rounded-[14px] p-7 grid grid-cols-1 md:grid-cols-[1fr_minmax(260px,320px)] gap-6 md:gap-8`} style={{ borderTop: `4px solid ${COLOR[k]}` }} data-testid="sh-company-details" data-ch={k}>
      <div className="flex flex-col gap-3 min-w-0">
        <h3 className="text-[28px] font-black leading-tight text-[#1B1530]">{c.title}</h3>
        <p className="text-[15px] text-[#6B6580]">
          {c.org} · {c.pattern}
        </p>
        <p className="text-[17px] leading-relaxed text-[#1B1530]">{c.blurb}</p>
        {brief?.challenge && (
          <details className="group/brief mt-1">
            <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 text-[15px] font-bold text-[#4A4EA3] [&::-webkit-details-marker]:hidden">
              <span className="group-open/brief:hidden">האתגר המלא, כפי שהוצג למשתתפות</span>
              <span className="hidden group-open/brief:inline">לסגירה</span>
              <span aria-hidden>←</span>
            </summary>
            <div className="mt-3 flex flex-col gap-2 bg-white border border-[#E3DDEE] rounded-[12px] p-5" data-testid="sh-brief">
              <p className="text-[15px] leading-relaxed text-[#1B1530]">{brief.challenge}</p>
              {brief.details?.length ? (
                <ul className="list-disc ps-5 text-[15px] text-[#4E4862] leading-relaxed flex flex-col gap-1">
                  {brief.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        )}
      </div>
      <div className="bg-white border border-[#E3DDEE] rounded-[12px] p-6 flex flex-col gap-2 text-[15px] leading-relaxed self-start" data-testid="sh-company-finals">
        {finals.winner && (
          <div>
            <span className="font-black text-[#B0154B]">זוכת האתגר: </span>
            <Link href={`${BASE}/${finals.winner.k8}`} className="font-bold text-[#4A4EA3] underline underline-offset-4 hover:text-[#1B1530]" data-testid="sh-finals-link">
              {teamName(finals.winner)}
            </Link>
          </div>
        )}
        {finals.finalists.length > 0 && (
          <div className="text-[#4E4862]">
            <span className="font-bold">עלו לגמר: </span>
            {finals.finalists.map((f, i) => (
              <Fragment key={f.k8}>
                {i > 0 && " · "}
                <Link href={`${BASE}/${f.k8}`} className="text-[#4A4EA3] underline underline-offset-4 hover:text-[#1B1530]" data-testid="sh-finals-link">
                  {teamName(f)}
                </Link>
              </Fragment>
            ))}
          </div>
        )}
        <Link href={href} className="mt-3 inline-flex items-center gap-1.5 min-h-11 text-[15px] font-bold text-[#4A4EA3] hover:text-[#1B1530]" data-testid="sh-company-projects">
          {count} פרויקטים ←
        </Link>
      </div>
    </div>
  );
}

/** One sentence from a participant, with the way to her project - between the partners and the employers. */
export function Quote({ p }: { p: ShowcaseProject | null }) {
  const q = p?.quotes[0];
  if (!p || !q) return null;
  return (
    <section className={`${WRAP} pt-14 pb-2`}>
      <figure className="m-0 px-9 py-8 rounded-[12px] bg-[#F7F5FB] border border-[#E3DDEE] flex flex-col gap-3" data-testid="sh-quotes">
        <blockquote className="m-0 text-[22px] leading-relaxed font-medium text-[#1B1530]">״{q.quote}״</blockquote>
        <figcaption className="text-[15px] text-[#4E4862] flex items-center gap-4 flex-wrap">
          <span>
            <span className="font-bold text-[#1B1530]">{q.name}</span>, {CHALLENGE_INFO[p.challenge].short}
          </span>
          <ProjectLink p={p} />
        </figcaption>
      </figure>
    </section>
  );
}

/** The employers' call - the canvas's dark block on white. The words are the first portal's. */
export function Employers() {
  return (
    <section id="employers" className={`${WRAP} py-22 scroll-mt-16`} data-testid="sh-employers">
      <div className="rounded-[16px] bg-[#1B1530] text-white px-8 py-10 sm:px-12 sm:py-14 flex flex-wrap items-center justify-between gap-7" style={{ borderTop: "6px solid #D81B5C" }}>
        <div className="flex-[999_1_420px] min-w-0 flex flex-col gap-3">
          <h2 className="text-[30px] sm:text-[36px] font-extrabold leading-[1.2]">מחפשים מפתחת AI לצוות שלכם?</h2>
          <p className="text-[18px] leading-relaxed text-[#DCD7E8] max-w-2xl">
            כל פרויקט כאן נבנה בשבוע, על בעיה אמיתית של ארגון אמיתי, ועלה לענן. מי שבנתה אותו - בוגרת מסלול פיתוח, חברה בקהילת קוד פתוח, ומחפשת את הצוות הבא שלה.
          </p>
        </div>
        <div className="flex-[1_1_260px] flex flex-wrap gap-3">
          <a href={MAIL_HREF} className={`${BTN_PINK} min-h-13 px-7 text-[17px]`}>
            דברו איתנו · office@opencode.org.il
          </a>
          <Link href="/portal" className={`${BTN_GHOST} min-h-13 px-7 text-[17px]`}>
            לפורטל המעסיקים
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[#ECE8F2]">
      <div className={`${WRAP} py-7 flex flex-wrap justify-between gap-3 text-[14px] text-[#6B6580]`}>
        <span>קהילת קוד פתוח · השמה. הכשרה. תרבות</span>
        <span>האקתון AI קוד פתוח 2026</span>
      </div>
    </footer>
  );
}
