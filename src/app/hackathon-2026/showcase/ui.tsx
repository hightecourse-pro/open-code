// The second design of the projects portal (the owner, 4/11, from her Claude Design canvas): white
// ground, ink #1B1530, pink #D81B5C, indigo #4A4EA3, Heebo, 8-14px corners, no doodles and no tilt.
// A separate route (/hackathon-2026/showcase) beside the first one, so the two can be compared.
// Same static data, the booklet's words, nothing judged. The pieces here need no browser state.
import Image from "next/image";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Logo } from "@/components/ui";
import { CHALLENGE_INFO, CHALLENGE_ORDER, COUNTS, SHOWCASE2_PATH as BASE, STATS, awardOf, finalsOf, hasStream, projectsOf, teamName, type ChallengeKey, type ShowcaseProject } from "@/lib/hackathon-showcase";
import { CHALLENGES } from "../shared";
import { CountUp } from "../projects/reveal";

/** The partner's colour - the top rule of its tile and of its details panel. */
export const COLOR: Record<ChallengeKey, string> = { strauss: "#D81B5C", virology: "#4A4EA3", phoenix: "#923F84" };

export const BTN = "inline-flex items-center justify-center gap-2 min-h-11 px-6 rounded-lg font-bold text-[15px] transition-colors";
export const BTN_PINK = `${BTN} bg-[#D81B5C] text-white hover:bg-[#B0154B]`;
export const BTN_INK = `${BTN} border-[1.5px] border-[#1B1530] text-[#1B1530] hover:bg-[#1B1530] hover:text-white`;
export const BTN_WHITE = `${BTN} bg-white text-[#1B1530] hover:bg-[#F7F5FB]`;
export const BTN_GHOST = `${BTN} border border-[#5A5175] text-white hover:bg-white/10`;
export const WRAP = "max-w-[1240px] mx-auto px-6";

/** The small pink label above a heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="text-[13.5px] font-bold tracking-wide text-[#B0154B]">{children}</span>;
}

/** Sticky top bar: the community's logo home, four anchors, the employers' button. */
export function TopBar({ onProjectPage = false }: { onProjectPage?: boolean }) {
  const anchor = (hash: string) => (onProjectPage ? `${BASE}#${hash}` : `#${hash}`);
  const item = "px-2.5 py-1.5 rounded-md text-[14.5px] font-medium text-[#1B1530] hover:bg-[#F7F5FB] transition-colors";
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-[#ECE8F2]" data-testid="sh-topbar">
      <div className={`${WRAP} h-16 flex items-center gap-4`}>
        <Link href="/" className="shrink-0" aria-label="קהילת קוד פתוח">
          <Logo width={110} />
        </Link>
        <Link href={BASE} className="shrink-0 hidden sm:block" aria-label="הפרויקטים של האקתון AI 2026">
          <Image src="/live/hackathon-color.png" alt="האקתון AI 2026" width={1000} height={573} className="h-9 w-auto" />
        </Link>
        <nav className="ms-auto flex items-center gap-0.5 sm:gap-1">
          <Link href={anchor("challenges")} className={item}>
            האתגרים
          </Link>
          <Link href={anchor("featured")} className={`${item} hidden sm:block`}>
            הזוכות
          </Link>
          <Link href={anchor("projects")} className={item}>
            הפרויקטים
          </Link>
          <Link href={anchor("numbers")} className={`${item} hidden md:block`}>
            במספרים
          </Link>
          <Link href={anchor("employers")} className="ms-1 inline-flex items-center min-h-10 px-4 rounded-lg bg-[#1B1530] text-white text-[14.5px] font-bold hover:bg-[#2A2244] transition-colors">
            למעסיקים
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** One of the four headline figures under the hero. */
export function StatBox({ n, label }: { n: number; label: string }) {
  return (
    <div className="bg-white px-6 py-5 flex flex-col gap-1" data-testid="sh-stat">
      <CountUp to={n} className="text-[38px] leading-none font-black text-[#4A4EA3]" />
      <span className="text-[14.5px] text-[#4E4862]">{label}</span>
    </div>
  );
}

/** ״זוכת האתגר״ / ״עלתה לגמר״ - nothing for the other projects. */
export function AwardTag({ p, className = "" }: { p: ShowcaseProject; className?: string }) {
  const a = awardOf(p);
  if (!a) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full text-[12px] font-bold px-2.5 py-1 whitespace-nowrap ${a.kind === "winner" ? "bg-[#D81B5C] text-white" : "bg-white text-[#1B1530] border border-[#1B1530]"} ${className}`}
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
    <span className={`inline-flex items-center rounded-full bg-[#EEEFFA] text-[#3B3F8F] text-[12px] font-bold px-2.5 py-0.5 ${className}`} data-testid="sh-chip" data-ch={k}>
      {CHALLENGE_INFO[k].short}
    </span>
  );
}

/** A technology: a plain label on a card, or a link into the portal filtered by it. */
export function Tech({ name, href, count }: { name: string; href?: string; count?: number }) {
  const cls = "inline-flex items-center gap-1 rounded-md bg-[#F4F2F8] text-[#4E4862] text-[12.5px] px-2 py-0.5 whitespace-nowrap";
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

/** One project in the grid - the whole card is the link to its page. */
export function ProjectCard({ p, eager = false }: { p: ShowcaseProject; eager?: boolean }) {
  const title = teamName(p);
  return (
    <Link
      href={`${BASE}/${p.k8}`}
      className="group flex flex-col h-full bg-white border border-[#ECE8F2] rounded-[14px] overflow-hidden hover:border-[#1B1530] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#4A4EA3]"
      data-testid="sh-card"
      data-k8={p.k8}
      data-ch={p.challenge}
    >
      <span className="relative block aspect-[16/9] bg-[#F2EFF8] border-b border-[#ECE8F2] overflow-hidden">
        {p.image && <Image src={p.image} alt={p.caption ?? title} fill sizes="(min-width: 1280px) 300px, (min-width: 640px) 50vw, 100vw" className="object-cover object-top" priority={eager} />}
        <AwardTag p={p} className="absolute top-3 left-3" />
        {hasStream(p) && <span className="absolute bottom-3 left-3 rounded-md bg-[#1B1530]/85 text-white text-[12px] font-bold px-2 py-0.5">סרטון</span>}
      </span>
      <span className="flex flex-col gap-2.5 p-5 flex-1">
        <ChallengeChip k={p.challenge} className="self-start" />
        <span className="text-[19px] font-bold leading-tight text-[#1B1530]">{title}</span>
        <span className="text-[14.5px] text-[#4E4862] leading-relaxed line-clamp-3">{p.blurb}</span>
        <span className="flex flex-wrap gap-1.5 mt-auto pt-1">
          {p.tech.slice(0, 5).map((t) => (
            <Tech key={t} name={t} />
          ))}
          {p.tech.length > 5 && <span className="text-[12px] text-[#6B6580] px-1 py-0.5">+{p.tech.length - 5}</span>}
        </span>
        <span className="flex items-center justify-between gap-3 pt-3 border-t border-[#F0EDF5] text-[13px] text-[#6B6580]">
          <span>{p.members.length === 1 ? "מפתחת אחת" : "זוג"}</span>
          <span className="font-bold text-[#4A4EA3] group-hover:text-[#1B1530]">לפרויקט ←</span>
        </span>
      </span>
    </Link>
  );
}

/**
 * What opens under a partner's tile on a click (the owner, 4/11: ״רק בלחיצה נפתח פרטים״): the
 * booklet's title and paragraph, the winner and the finalists, the full brief folded, and the way
 * into the filtered grid.
 */
export function CompanyDetails({ k, href = "#projects", className = "bg-[#F7F5FB]" }: { k: ChallengeKey; href?: string; className?: string }) {
  const c = CHALLENGE_INFO[k];
  const brief = CHALLENGES.find((x) => x.key === k);
  const finals = finalsOf(k);
  const count = projectsOf(k).length;
  return (
    <div className={`${className} rounded-[14px] p-6 sm:p-7 grid grid-cols-1 md:grid-cols-[1fr_minmax(260px,320px)] gap-6 md:gap-8`} style={{ borderTop: `4px solid ${COLOR[k]}` }} data-testid="sh-company-details" data-ch={k}>
      <div className="flex flex-col gap-3 min-w-0">
        <h3 className="text-[24px] font-black leading-tight text-[#1B1530]">{c.title}</h3>
        <p className="text-[14.5px] text-[#6B6580]">
          {c.org} · {c.pattern}
        </p>
        <p className="text-[16px] leading-relaxed text-[#1B1530]">{c.blurb}</p>
        {brief?.challenge && (
          <details className="group/brief mt-1">
            <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 text-[14.5px] font-bold text-[#4A4EA3] [&::-webkit-details-marker]:hidden">
              <span className="group-open/brief:hidden">האתגר המלא, כפי שהוצג למשתתפות</span>
              <span className="hidden group-open/brief:inline">לסגירה</span>
              <span className="group-open/brief:rotate-90 transition-transform">›</span>
            </summary>
            <div className="mt-3 flex flex-col gap-2 bg-white border border-[#E3DDEE] rounded-[12px] p-4" data-testid="sh-brief">
              <p className="text-[15px] leading-relaxed text-[#1B1530]">{brief.challenge}</p>
              {brief.details?.length ? (
                <ul className="list-disc ps-5 text-[14.5px] text-[#4E4862] leading-relaxed flex flex-col gap-1">
                  {brief.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        )}
      </div>
      <div className="bg-white border border-[#E3DDEE] rounded-[12px] p-5 flex flex-col gap-2 text-[14.5px] leading-relaxed self-start" data-testid="sh-company-finals">
        {finals.winner && (
          <div>
            <span className="font-black text-[#B0154B]">זוכת האתגר: </span>
            <Link href={`${BASE}/${finals.winner.k8}`} className="font-bold text-[#1B1530] hover:underline">
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
                <Link href={`${BASE}/${f.k8}`} className="hover:underline">
                  {teamName(f)}
                </Link>
              </Fragment>
            ))}
          </div>
        )}
        <Link href={href} className={`${BTN_INK} mt-2 self-start min-h-10 px-4 text-[14px]`} data-testid="sh-company-projects">
          {count} פרויקטים
        </Link>
      </div>
    </div>
  );
}

/** The three winners in one thin row (the owner, 4/11: ״תופס מקום רב מידי״) - the grid follows right under it. */
export function WinnersStrip() {
  return (
    <section id="featured" className={`${WRAP} pt-12 scroll-mt-16`} data-testid="sh-winners">
      <div className="flex items-baseline gap-3 flex-wrap">
        <Eyebrow>הזוכות</Eyebrow>
        <span className="text-[13.5px] text-[#6B6580]">ערב הגמר 28.10 · שופטות 70 · קהל 30</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
        {CHALLENGE_ORDER.map((k) => {
          const w = finalsOf(k).winner;
          if (!w) return null;
          return (
            <Link
              key={k}
              href={`${BASE}/${w.k8}`}
              className="flex items-center gap-4 p-3 rounded-[12px] border border-[#ECE8F2] bg-white hover:border-[#1B1530] transition-colors"
              data-testid="sh-winner"
              data-k8={w.k8}
              data-ch={k}
            >
              <span className="relative block w-[112px] h-[64px] shrink-0 rounded-[8px] overflow-hidden bg-[#F2EFF8]">
                {w.image && <Image src={w.image} alt="" fill sizes="112px" className="object-cover object-top" />}
              </span>
              <span className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[12px] font-bold text-[#B0154B]">זוכת האתגר · {CHALLENGE_INFO[k].short}</span>
                <span className="text-[17px] font-black leading-tight text-[#1B1530] truncate">{teamName(w)}</span>
                <span className="text-[12.5px] text-[#6B6580] truncate" dir="ltr">
                  {w.tech.slice(0, 3).join(" · ")}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function Bars({ rows, max, hrefOf }: { rows: { name: string; count: number }[]; max: number; hrefOf?: (name: string) => string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const body = (
          <>
            <span className="text-[14px] font-bold text-[#1B1530] truncate" dir="auto">
              {r.name}
            </span>
            <span className="h-2.5 rounded-full bg-[#ECE8F2] overflow-hidden" aria-hidden>
              <span className="block h-full rounded-full bg-[#4A4EA3]" style={{ width: `${Math.max(3, (r.count / Math.max(1, max)) * 100)}%` }} />
            </span>
            <span className="text-[14px] font-black text-[#1B1530] text-left" style={{ fontVariantNumeric: "tabular-nums" }}>
              {r.count}
            </span>
          </>
        );
        const cls = "grid grid-cols-[minmax(0,120px)_1fr_auto] items-center gap-3";
        return hrefOf ? (
          <Link key={r.name} href={hrefOf(r.name)} className={`${cls} rounded-md -mx-1 px-1 hover:bg-[#F7F5FB]`} data-testid="sh-bar">
            {body}
          </Link>
        ) : (
          <div key={r.name} className={cls} data-testid="sh-bar">
            {body}
          </div>
        );
      })}
    </div>
  );
}

function NumberCard({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-[12px] p-6 flex flex-col gap-4 ${className}`}>
      <h3 className="text-[18px] font-bold text-[#1B1530]">{title}</h3>
      {children}
    </div>
  );
}

/** ״ההאקתון במספרים״ - the dashboard's figures, flat: labels and numbers, no sentences. */
export function Numbers() {
  const s = STATS;
  const tech = (name: string) => `${BASE}?t=${encodeURIComponent(name)}#projects`;
  return (
    <section id="numbers" className="bg-[#F7F5FB] scroll-mt-16" data-testid="sh-numbers">
      <div className={`${WRAP} py-16 flex flex-col gap-8`}>
        <div className="flex flex-col gap-2">
          <Eyebrow>ההאקתון במספרים</Eyebrow>
          <h2 className="text-[32px] sm:text-[36px] font-extrabold leading-tight text-[#1B1530]">
            {COUNTS.projects} פרויקטים · {COUNTS.people} מפתחות · {s.tech} טכנולוגיות · {COUNTS.institutions} מוסדות לימוד
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <NumberCard title="המודל שבתוך המוצר">
            <Bars rows={s.models} max={COUNTS.projects} hrefOf={tech} />
          </NumberCard>
          <NumberCard title="איפה המערכות רצות">
            <Bars rows={s.hosts} max={s.hosts[0]?.count ?? 1} />
            <p className="text-[13.5px] text-[#6B6580] mt-auto">
              {s.live} מערכות חיות בענן · {s.videos} סרטונים
            </p>
          </NumberCard>
          <NumberCard title="לבד או בזוג">
            <Bars rows={[{ name: "מפתחת אחת", count: s.solo }, { name: "זוג", count: s.pairs }]} max={Math.max(s.solo, s.pairs)} />
            <Bars rows={s.byChallenge.map((c) => ({ name: CHALLENGE_INFO[c.key].short, count: c.count }))} max={Math.max(...s.byChallenge.map((c) => c.count))} hrefOf={(name) => `${BASE}?ch=${CHALLENGE_ORDER.find((k) => CHALLENGE_INFO[k].short === name) ?? ""}#projects`} />
          </NumberCard>
          <NumberCard title={`${s.topTech.length} הטכנולוגיות הנפוצות`} className="md:col-span-3">
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
              <Bars rows={s.topTech.slice(0, 5)} max={s.topTech[0]?.count ?? 1} hrefOf={tech} />
              <Bars rows={s.topTech.slice(5, 10)} max={s.topTech[0]?.count ?? 1} hrefOf={tech} />
            </div>
          </NumberCard>
        </div>
      </div>
    </section>
  );
}

/** Three of the participants' own sentences, verbatim. */
export function Quotes({ items }: { items: { p: ShowcaseProject; i: number }[] }) {
  return (
    <section className={`${WRAP} py-16 flex flex-col gap-5`} data-testid="sh-quotes">
      <Eyebrow>במילים שלהן</Eyebrow>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {items.map(({ p, i }) => {
          const q = p.quotes[i] ?? p.quotes[0];
          if (!q) return null;
          return (
            <figure key={q.id} className="m-0 p-6 rounded-[12px] border border-[#E3DDEE] bg-white flex flex-col gap-3">
              <blockquote className="m-0 text-[17px] leading-relaxed font-medium text-[#1B1530] flex-1">״{q.quote}״</blockquote>
              <figcaption className="text-[14px] text-[#4E4862]">
                <Link href={`${BASE}/${p.k8}`} className="font-bold hover:underline">
                  {q.name}
                </Link>{" "}
                · {CHALLENGE_INFO[p.challenge].short}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

/** The employers' call - the reason the portal exists. The words are the first portal's. */
export function Employers() {
  return (
    <section id="employers" className={`${WRAP} py-16 scroll-mt-16`} data-testid="sh-employers">
      <div className="rounded-[16px] bg-[#1B1530] text-white p-8 sm:p-12 flex flex-wrap items-center justify-between gap-7" style={{ borderTop: "6px solid #D81B5C" }}>
        <div className="flex-[999_1_420px] min-w-0 flex flex-col gap-3">
          <h2 className="text-[30px] sm:text-[36px] font-extrabold leading-tight">מחפשים מפתחת AI לצוות שלכם?</h2>
          <p className="text-[17px] leading-relaxed text-[#DCD7E8] max-w-2xl">
            כל פרויקט כאן נבנה בשבועיים, על בעיה אמיתית של ארגון אמיתי, ועלה לענן. מי שבנתה אותו - בוגרת מסלול פיתוח, חברה בקהילת קוד פתוח, ומחפשת את הצוות הבא שלה.
          </p>
        </div>
        <div className="flex-[1_1_260px] flex flex-wrap gap-3">
          <a href="mailto:office@opencode.org.il?subject=%D7%94%D7%A4%D7%A8%D7%95%D7%99%D7%A7%D7%98%D7%99%D7%9D%20%D7%A9%D7%9C%20%D7%94%D7%90%D7%A7%D7%AA%D7%95%D7%9F" className={`${BTN_PINK} min-h-13 text-[16px]`}>
            דברו איתנו · office@opencode.org.il
          </a>
          <Link href="/portal" className={`${BTN_GHOST} min-h-13 text-[16px]`}>
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
