// The numbers dashboard of the portal (the owner, 2/11: ״דשבורד נחמד של מספרים״ instead of the long
// text at the top): four headline figures that count up, the projects per challenge, where the live
// systems run, the ten most used technologies, and two small splits - alone or in pairs, and the AI
// models inside the products. Every bar carries its own label and number, so colour never stands
// alone; every bar that can filter the projects is a link into the explorer.
import Link from "next/link";
import type { ReactNode } from "react";
import { CHALLENGE_INFO, COUNTS, SHOWCASE_PATH, STATS, type ChallengeKey } from "@/lib/hackathon-showcase";
import { Squiggle } from "../shared";
import { CountUp, Reveal } from "./reveal";

/** The challenge's bar colour - one hue per challenge, the family of its card tint. */
const BAR: Record<ChallengeKey, string> = { strauss: "#1B9E6A", virology: "#E0418D", phoenix: "#E9892A" };

function Card({ children, className = "", title, eyebrow, testid }: { children: ReactNode; className?: string; title?: string; eyebrow?: string; testid?: string }) {
  return (
    <div className={`bg-white rounded-[22px] border border-ink-200 shadow-[0_10px_30px_-18px_rgba(70,76,160,.35)] p-5 flex flex-col gap-3 ${className}`} data-testid={testid}>
      {(eyebrow || title) && (
        <div className="flex flex-col gap-0.5">
          {eyebrow && <span className="font-mono text-[12px] text-brand-pink-deep">{eyebrow}</span>}
          {title && <h3 className="font-display font-black text-[18px] leading-tight text-ink-900">{title}</h3>}
        </div>
      )}
      {children}
    </div>
  );
}

/** One row: label on the right, a bar that grows from the right once the card is seen, the count on the left. */
function BarRow({ label, count, max, color, href, suffix, emoji, i = 0, wide = false }: { label: string; count: number; max: number; color?: string; href?: string; suffix?: string; emoji?: string; i?: number; wide?: boolean }) {
  const body = (
    <>
      <span className={`flex items-center gap-1.5 text-[14px] font-bold text-ink-900 min-w-0 ${wide ? "leading-tight" : "whitespace-nowrap"}`}>
        {emoji && <span aria-hidden>{emoji}</span>}
        <span className={wide ? "" : "truncate"} dir="auto">{label}</span>
      </span>
      <span className="h-3 rounded-full bg-ink-100 overflow-hidden" aria-hidden>
        <span
          className={`sc-bar block h-full rounded-full ${color ? "" : "bg-brand-gradient"}`}
          style={{ ["--w" as string]: `${Math.max(3, (count / Math.max(1, max)) * 100)}%`, ["--d" as string]: `${120 + i * 70}ms`, ...(color ? { background: color } : {}) }}
        />
      </span>
      <span className="font-display font-black text-[15px] text-ink-900 text-left whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
        {count}
        {suffix && <span className="text-[12px] font-semibold text-ink-400"> · {suffix}</span>}
      </span>
    </>
  );
  const cols = wide ? "grid-cols-[minmax(0,125px)_1fr_auto] sm:grid-cols-[minmax(0,205px)_1fr_auto]" : "grid-cols-[minmax(0,105px)_1fr_auto] sm:grid-cols-[minmax(0,125px)_1fr_auto]";
  const cls = `grid ${cols} items-center gap-3 py-0.5`;
  return href ? (
    <Link href={href} className={`${cls} rounded-lg -mx-1 px-1 hover:bg-tint-pink/60 transition-colors`} data-testid="sc-bar-row" title={`לפרויקטים עם ${label}`}>
      {body}
    </Link>
  ) : (
    <div className={cls} data-testid="sc-bar-row">
      {body}
    </div>
  );
}

export function StatsDashboard() {
  const s = STATS;
  const maxCh = Math.max(...s.byChallenge.map((c) => c.count));
  const maxTech = s.topTech[0]?.count ?? 1;
  const kpis: { n: number; label: string; sub: string; emoji: string }[] = [
    { n: COUNTS.projects, label: "פרויקטים", sub: `${s.live} חיים בענן · ${s.videos} עם סרטון`, emoji: "🚀" },
    { n: COUNTS.people, label: "מפתחות", sub: "מקהילת קוד פתוח", emoji: "👩‍💻" },
    { n: s.tech, label: "טכנולוגיות", sub: `כ-${s.avgTech} בממוצע לפרויקט`, emoji: "🧰" },
    ...(COUNTS.institutions ? [{ n: COUNTS.institutions, label: "מוסדות לימוד", sub: "מהם הגיעו המפתחות", emoji: "🎓" }] : []),
  ];
  const splitTotal = s.solo + s.pairs;
  return (
    <section id="numbers" className="px-4 sm:px-6 pb-14 scroll-mt-14" data-testid="sc-dash">
      <div className="max-w-6xl mx-auto">
        <Reveal className="text-center mb-7">
          <span className="font-mono text-xs text-brand-pink-deep">&lt;במספרים/&gt;</span>
          <h2 className="font-display text-[28px] sm:text-[30px] font-black mt-1 relative inline-block">
            ההאקתון במספרים
            <Squiggle className="absolute -bottom-3 right-2 w-28 h-3" />
          </h2>
        </Reveal>

        <div className="bg-tint-purple/50 rounded-[30px] p-3 sm:p-5 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* the four headline figures */}
          {kpis.map((k, i) => (
            <Reveal key={k.label} delay={i * 90} className="h-full">
              <Card className="h-full items-start gap-1 relative" testid="sc-kpi">
                <span aria-hidden className="absolute top-4 left-4 w-9 h-9 rounded-full bg-tint-pink flex items-center justify-center text-[18px]">
                  {k.emoji}
                </span>
                <CountUp to={k.n} className="font-display font-black text-[46px] sm:text-[54px] leading-none sc-num" />
                <span className="font-display font-black text-[17px] text-ink-900 mt-1">{k.label}</span>
                <span className="text-[13.5px] text-ink-500 font-semibold leading-snug">{k.sub}</span>
              </Card>
            </Reveal>
          ))}

          {/* per challenge */}
          <Reveal delay={120} className="col-span-2 h-full">
            <Card className="h-full" eyebrow="// לפי אתגר" title="כמה פרויקטים לכל אתגר?" testid="sc-dash-challenges">
              <div className="flex flex-col gap-4 my-auto py-1">
                {s.byChallenge.map((c, i) => (
                  <BarRow
                    key={c.key}
                    i={i}
                    wide
                    label={CHALLENGE_INFO[c.key].short}
                    emoji={CHALLENGE_INFO[c.key].emoji}
                    count={c.count}
                    max={maxCh}
                    color={BAR[c.key]}
                    href={`${SHOWCASE_PATH}?ch=${c.key}#projects`}
                    suffix={`${Math.round((c.count / Math.max(1, COUNTS.projects)) * 100)}%`}
                  />
                ))}
              </div>
              <p className="text-[13px] text-ink-500 mt-auto pt-1">שלושה ארגונים, שלוש בעיות אמיתיות. לחיצה על אתגר מסננת את הפרויקטים.</p>
            </Card>
          </Reveal>

          {/* where the live systems run */}
          <Reveal delay={180} className="col-span-2 h-full">
            <Card className="h-full" eyebrow="// הענן" title="איפה המערכות רצות?" testid="sc-dash-hosts">
              <div className="flex flex-col gap-1.5 mt-1">
                {s.hosts.map((h, i) => (
                  <BarRow key={h.name} i={i} label={h.name} count={h.count} max={s.hosts[0]?.count ?? 1} />
                ))}
              </div>
              <p className="text-[13px] text-ink-500 mt-auto pt-1">כל אחת מ-{s.live} המערכות רצה בענן, בכתובת ציבורית, ונפתחת מעמוד הפרויקט.</p>
            </Card>
          </Reveal>

          {/* the technologies */}
          <Reveal delay={240} className="col-span-2 h-full">
            <Card className="h-full" eyebrow="// הטכנולוגיות" title={`${s.topTech.length} הטכנולוגיות הנפוצות`} testid="sc-dash-tech">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-1">
                {s.topTech.map((t, i) => (
                  <BarRow key={t.name} i={i} label={t.name} count={t.count} max={maxTech} href={`${SHOWCASE_PATH}?t=${encodeURIComponent(t.name)}#projects`} />
                ))}
              </div>
              <p className="text-[13px] text-ink-500 mt-auto pt-1">מספר הפרויקטים שהשתמשו בכל טכנולוגיה. לחיצה מסננת את הפרויקטים.</p>
            </Card>
          </Reveal>

          {/* alone or in pairs */}
          <Reveal delay={300} className="col-span-2 lg:col-span-1 h-full">
            <Card className="h-full" eyebrow="// צוותים" title="לבד או בזוג?" testid="sc-dash-teams">
              <div className="flex h-4 rounded-full overflow-hidden gap-0.5 mt-1" aria-hidden>
                <span className="sc-bar block h-full bg-brand-purple rounded-s-full" style={{ ["--w" as string]: `${(s.solo / splitTotal) * 100}%`, ["--d" as string]: "160ms" }} />
                <span className="sc-bar block h-full bg-brand-pink rounded-e-full" style={{ ["--w" as string]: `${(s.pairs / splitTotal) * 100}%`, ["--d" as string]: "160ms" }} />
              </div>
              <ul className="flex flex-col gap-1.5 text-[14px] text-ink-900">
                <li className="flex items-center gap-2">
                  <i className="w-3 h-3 rounded-full bg-brand-purple shrink-0" aria-hidden />
                  <b className="font-display font-black text-[16px]" style={{ fontVariantNumeric: "tabular-nums" }}>{s.solo}</b> פרויקטים של מפתחת אחת
                </li>
                <li className="flex items-center gap-2">
                  <i className="w-3 h-3 rounded-full bg-brand-pink shrink-0" aria-hidden />
                  <b className="font-display font-black text-[16px]" style={{ fontVariantNumeric: "tabular-nums" }}>{s.pairs}</b> של זוגות
                </li>
              </ul>
            </Card>
          </Reveal>

          {/* the AI models */}
          <Reveal delay={360} className="col-span-2 lg:col-span-1 h-full">
            <Card className="h-full" eyebrow="// המודלים" title="המודל שבתוך המוצר" testid="sc-dash-models">
              <div className="flex flex-col gap-2 mt-1">
                {s.models.map((m, i) => (
                  <BarRow key={m.name} i={i} label={m.name} count={m.count} max={COUNTS.projects} href={`${SHOWCASE_PATH}?t=${encodeURIComponent(m.name)}#projects`} />
                ))}
              </div>
              <p className="text-[13px] text-ink-500 mt-auto pt-1">מתוך {COUNTS.projects} פרויקטים. יש שעובדים עם יותר ממודל אחד.</p>
            </Card>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
