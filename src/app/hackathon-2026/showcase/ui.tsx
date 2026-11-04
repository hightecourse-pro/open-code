// The second design of the projects portal (the owner, 4/11, from her Claude Design canvas): white
// ground, ink #1B1530, pink #D81B5C, indigo #4A4EA3, Heebo, 8-14px corners, no doodles and no tilt.
// A separate route (/hackathon-2026/showcase) beside the first one, so the two can be compared.
// Same static data, the booklet's words, nothing judged. The pieces here need no browser state.
//
// The canvas's rhythm, kept exactly (the owner, 4/11: ״בלגן קצת בעין במעבר בין החלקים - תיצמד יותר
// לעיצוב בדיזיין״): one container (1240 + 24px gutters), one heading block in every section (an eyebrow
// of 14px, an h2 of 40px/800, an optional 18px line), 88px above a section, cards with 1px #ECE8F2
// borders and 12-14px corners, white sections between the tinted hero, the tinted ״numbers״ and the
// dark employers' block on white.
import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Logo } from "@/components/ui";
import { CHALLENGE_INFO, CHALLENGE_ORDER, COUNTS, SHOWCASE2_PATH as BASE, STATS, awardOf, finalsOf, projectsOf, teamName, type ChallengeKey, type ShowcaseProject } from "@/lib/hackathon-showcase";
import { CHALLENGES } from "../shared";
import { CountUp } from "../projects/reveal";

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

/** Sticky top bar, as the canvas's header: the community's logo, the anchors, the dark button. */
export function TopBar({ onProjectPage = false }: { onProjectPage?: boolean }) {
  const anchor = (hash: string) => (onProjectPage ? `${BASE}#${hash}` : `#${hash}`);
  const item = "text-[16px] font-medium text-[#1B1530] hover:text-[#4A4EA3] transition-colors";
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#ECE8F2]" data-testid="sh-topbar">
      <div className={`${WRAP} py-3 flex flex-wrap items-center justify-between gap-4`}>
        <Link href="/" className="shrink-0" aria-label="קהילת קוד פתוח">
          <Logo width={132} />
        </Link>
        <nav className="flex flex-wrap items-center gap-5 sm:gap-7">
          <Link href={anchor("challenges")} className={item}>
            האתגרים
          </Link>
          <Link href={anchor("featured")} className={item}>
            הזוכות
          </Link>
          <Link href={anchor("about")} className={`${item} hidden sm:block`}>
            איך זה עבד
          </Link>
          <Link href={anchor("projects")} className={item}>
            כל הפרויקטים
          </Link>
          <Link href={anchor("numbers")} className={`${item} hidden md:block`}>
            במספרים
          </Link>
        </nav>
        <Link href={anchor("employers")} className="inline-flex items-center min-h-11 px-[22px] rounded-lg bg-[#1B1530] text-white text-[15px] font-bold hover:bg-[#2A2244] transition-colors">
          למעסיקים
        </Link>
      </div>
    </header>
  );
}

/** One of the four headline figures under the hero (the canvas's stats strip); with `href` the box leads somewhere. */
export function StatBox({ n, label, href }: { n: number; label: string; href?: string }) {
  const inner = (
    <>
      <CountUp to={n} className="text-[40px] leading-none font-black text-[#4A4EA3]" />
      <span className="text-[15px] text-[#4E4862]">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="bg-white px-7 py-6 flex flex-col gap-1 hover:bg-[#F7F5FB] transition-colors" data-testid="sh-stat">
      {inner}
    </Link>
  ) : (
    <div className="bg-white px-7 py-6 flex flex-col gap-1" data-testid="sh-stat">
      {inner}
    </div>
  );
}

/** ״זוכת האתגר״ / ״עלתה לגמר״ - nothing for the other projects. */
export function AwardTag({ p, className = "" }: { p: ShowcaseProject; className?: string }) {
  const a = awardOf(p);
  if (!a) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full text-[13px] font-bold px-3 py-1 whitespace-nowrap ${a.kind === "winner" ? "bg-[#D81B5C] text-white" : "bg-white text-[#1B1530] border border-[#1B1530]"} ${className}`}
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

/** A visible link to a project's page - the same words everywhere (the owner, 4/11: ״תן לינקים לפרויקטים בכל מקום״). */
export function ProjectLink({ p, className = "", dark = false }: { p: ShowcaseProject; className?: string; dark?: boolean }) {
  return (
    <Link href={`${BASE}/${p.k8}`} className={`inline-flex items-center gap-1 text-[15px] font-bold ${dark ? "text-[#F07AA3] hover:text-white" : "text-[#4A4EA3] hover:text-[#1B1530]"} ${className}`} data-testid="sh-project-link" data-k8={p.k8}>
      לפרויקט ←
    </Link>
  );
}

/** The live system in the cloud, when the project has one. */
export function LiveLink({ p, className = "" }: { p: ShowcaseProject; className?: string }) {
  if (!p.productUrl) return null;
  return (
    <a href={p.productUrl} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-[15px] font-bold text-[#1B1530] hover:text-[#4A4EA3] ${className}`} data-testid="sh-live-link">
      מערכת חיה ↗
    </a>
  );
}

/** One project in the grid, as the canvas draws it: the picture and the name lead to its page; the foot carries the two links. */
export function ProjectCard({ p, eager = false }: { p: ShowcaseProject; eager?: boolean }) {
  const title = teamName(p);
  const href = `${BASE}/${p.k8}`;
  return (
    <article className="flex flex-col h-full bg-white border border-[#ECE8F2] rounded-[14px] overflow-hidden hover:border-[#1B1530] transition-colors" data-testid="sh-card" data-k8={p.k8} data-ch={p.challenge}>
      <Link href={href} className="relative block h-[180px] bg-[#F2EFF8] border-b border-[#ECE8F2] overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#4A4EA3]" aria-label={title} tabIndex={-1}>
        {p.image && <Image src={p.image} alt={p.caption ?? title} fill sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" className="object-cover object-top" priority={eager} />}
        <AwardTag p={p} className="absolute top-3 left-3" />
      </Link>
      <div className="flex flex-col gap-3 p-[22px] flex-1">
        <ChallengeChip k={p.challenge} className="self-start" />
        <h3 className="text-[21px] font-bold leading-tight text-[#1B1530]">
          <Link href={href} className="hover:text-[#4A4EA3] hover:underline underline-offset-4">
            {title}
          </Link>
        </h3>
        <p className="text-[15px] text-[#4E4862] leading-relaxed line-clamp-3 flex-1">{p.blurb}</p>
        <div className="flex flex-wrap gap-1.5">
          {p.tech.slice(0, 4).map((t) => (
            <Tech key={t} name={t} />
          ))}
          {p.tech.length > 4 && <span className="text-[12px] text-[#6B6580] px-1 py-[3px]">+{p.tech.length - 4}</span>}
        </div>
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#F0EDF5]">
          <span className="text-[13px] text-[#6B6580]">{p.members.length === 1 ? "מפתחת אחת" : "זוג"}</span>
          <span className="flex items-center gap-4">
            <LiveLink p={p} />
            <ProjectLink p={p} />
          </span>
        </div>
      </div>
    </article>
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

/** ״איך זה עבד״ - the canvas's four numbered cards, with what really happened, one line each. */
export function HowItWorked() {
  const steps: [string, string][] = [
    ["הרשמה לאתגר", "חברות הקהילה, לבד או כזוג, אתגר אחד משלושה."],
    ["שבוע של פיתוח", "עם כלי ה-AI שכל אחת בחרה, עד מערכת שרצה בענן."],
    ["הגשת התוצרים", "קישור למערכת, גיט ציבורי, ארכיטקטורה, סרטון של עד דקה, הפיצ׳ר המקורי."],
    ["ערב הגמר 28.10", "שלוש עולות לגמר בכל אתגר. שופטות 70, קהל האולם 30."],
  ];
  return (
    <section id="about" className={`${WRAP} pt-22 pb-10 flex flex-col gap-10 scroll-mt-16`} data-testid="sh-about">
      <SectionHead eyebrow="איך זה עבד" title="מהרשמה לאתגר ועד ערב הגמר" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {steps.map(([title, text], i) => (
          <div key={title} className="flex flex-col gap-2.5 p-6 rounded-[12px] border border-[#ECE8F2] bg-white">
            <span className="text-[14px] font-extrabold text-[#4A4EA3]">0{i + 1}</span>
            <h3 className="text-[20px] font-bold text-[#1B1530]">{title}</h3>
            <p className="text-[15px] leading-relaxed text-[#4E4862]">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The three winners in the canvas's dark cards, folded to one thin row (the owner, 4/11: ״תופס מקום רב מידי״). */
export function WinnersStrip() {
  return (
    <section id="featured" className={`${WRAP} py-14 flex flex-col gap-7 scroll-mt-16`} data-testid="sh-winners">
      <SectionHead eyebrow="הזוכות" title="שלוש זוכות, אחת לכל אתגר" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CHALLENGE_ORDER.map((k) => {
          const w = finalsOf(k).winner;
          if (!w) return null;
          return (
            <div key={k} className="flex items-center gap-4 p-3 pe-5 rounded-[14px] bg-[#1B1530] text-white" data-testid="sh-winner" data-k8={w.k8} data-ch={k}>
              <Link href={`${BASE}/${w.k8}`} className="relative block w-[128px] h-[72px] shrink-0 rounded-[8px] overflow-hidden bg-[#2A2244]" aria-label={teamName(w)} tabIndex={-1}>
                {w.image && <Image src={w.image} alt="" fill sizes="128px" className="object-cover object-top" />}
              </Link>
              <span className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-[13px] font-bold text-[#F07AA3]">זוכת האתגר · {CHALLENGE_INFO[k].short}</span>
                <Link href={`${BASE}/${w.k8}`} className="text-[19px] font-extrabold leading-tight truncate hover:underline underline-offset-4">
                  {teamName(w)}
                </Link>
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-[#B9B2CC] truncate" dir="ltr">
                    {w.tech.slice(0, 3).join(" · ")}
                  </span>
                  <ProjectLink p={w} dark className="text-[14px] shrink-0" />
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Rows({ rows, hrefOf }: { rows: { name: string; count: number }[]; hrefOf?: (name: string) => string }) {
  return (
    <ul className="flex flex-col divide-y divide-[#F0EDF5]">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="text-[15px] text-[#1B1530]" dir="auto">
              {r.name}
            </span>
            <span className="text-[17px] font-black text-[#1B1530]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {r.count}
            </span>
          </>
        );
        return (
          <li key={r.name} data-testid="sh-bar">
            {hrefOf ? (
              <Link href={hrefOf(r.name)} className="flex items-center justify-between gap-3 py-2 hover:text-[#4A4EA3]">
                {inner}
              </Link>
            ) : (
              <span className="flex items-center justify-between gap-3 py-2">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const ICON = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "#D81B5C", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/** ״ההאקתון במספרים״ - the canvas's tinted band with three white cards and one quote. */
export function Numbers({ quote }: { quote: ShowcaseProject | null }) {
  const s = STATS;
  const tech = (name: string) => `${BASE}?t=${encodeURIComponent(name)}#projects`;
  const q = quote?.quotes[0];
  return (
    <section id="numbers" className="bg-[#F7F5FB] scroll-mt-16" data-testid="sh-numbers">
      <div className={`${WRAP} py-22 flex flex-col gap-10`}>
        <SectionHead eyebrow="ההאקתון במספרים" title={`${COUNTS.projects} פרויקטים, ${COUNTS.people} מפתחות, ${s.tech} טכנולוגיות`} line={`${s.live} מערכות חיות בענן, ${s.videos} סרטונים, ${COUNTS.institutions} מוסדות לימוד.`} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-[12px] p-7 flex flex-col gap-3">
            <svg {...ICON}>
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            <h3 className="text-[20px] font-bold text-[#1B1530]">המודל שבתוך המוצר</h3>
            <Rows rows={s.models} hrefOf={tech} />
          </div>
          <div className="bg-white rounded-[12px] p-7 flex flex-col gap-3">
            <svg {...ICON}>
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
            </svg>
            <h3 className="text-[20px] font-bold text-[#1B1530]">איפה המערכות רצות</h3>
            <Rows rows={s.hosts} />
          </div>
          <div className="bg-white rounded-[12px] p-7 flex flex-col gap-3">
            <svg {...ICON}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <h3 className="text-[20px] font-bold text-[#1B1530]">לבד או בזוג</h3>
            <Rows
              rows={[
                { name: "מפתחת אחת", count: s.solo },
                { name: "זוג", count: s.pairs },
              ]}
            />
            <Rows rows={s.byChallenge.map((c) => ({ name: CHALLENGE_INFO[c.key].short, count: c.count }))} hrefOf={(name) => `${BASE}?ch=${CHALLENGE_ORDER.find((k) => CHALLENGE_INFO[k].short === name) ?? ""}#projects`} />
          </div>
        </div>
        {q && (
          <figure className="m-0 px-9 py-8 rounded-[12px] bg-white border border-[#E3DDEE] flex flex-col gap-3" data-testid="sh-quotes">
            <blockquote className="m-0 text-[22px] leading-relaxed font-medium text-[#1B1530]">״{q.quote}״</blockquote>
            <figcaption className="text-[15px] text-[#4E4862] flex items-center gap-4 flex-wrap">
              <span>
                <span className="font-bold text-[#1B1530]">{q.name}</span>, {CHALLENGE_INFO[quote.challenge].short}
              </span>
              <ProjectLink p={quote} />
            </figcaption>
          </figure>
        )}
      </div>
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
          <a href="mailto:office@opencode.org.il?subject=%D7%94%D7%A4%D7%A8%D7%95%D7%99%D7%A7%D7%98%D7%99%D7%9D%20%D7%A9%D7%9C%20%D7%94%D7%90%D7%A7%D7%AA%D7%95%D7%9F" className={`${BTN_PINK} min-h-13 px-7 text-[17px]`}>
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
