import type { Metadata } from "next";
import Link from "next/link";
import { Gavel } from "lucide-react";
import { requireCommunityAccess } from "@/lib/auth";
import { judgeAccessFor, loadJudgingBoard, type JudgingEntry } from "@/lib/judging";
import { CRITERIA } from "@/lib/judging-shared";
import { guarded } from "@/lib/error-log";
import { CHALLENGES, H26Style, HackathonLogo, Squiggle } from "@/app/hackathon-2026/shared";
import { JudgingDesk } from "./judging-desk";

export const metadata: Metadata = { title: "שיפוט ההאקתון" };
export const dynamic = "force-dynamic";

/** `?as=judge`: the owner sees the page exactly as an appointed judge does (26/10). */
const PREVIEW = "judge";

/**
 * שיפוט ההאקתון (the owner, 16/10; the desk 23/10): an appointed judge - a
 * mentor or a team member - scores the projects of her challenges, one at a
 * time, and sees only her own scores. The owner (an admin who is not an
 * appointed judge) sees every project and every score - and, with ?as=judge,
 * the page as a judge sees it (26/10: "תציג גם לי כאילו אני שופטת").
 */
export default async function JudgePage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return guarded("/judge", () => judgePageBody(searchParams));
}

async function judgePageBody(searchParams: Promise<{ as?: string }>) {
  const profile = await requireCommunityAccess();
  const access = await judgeAccessFor(profile);
  if (!access.judge) {
    return (
      <div className="flex flex-col gap-5 max-w-5xl">
        <H26Style />
        <Header subtitle="לשופטות שהצוות מינה." />
        <section className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-[14px] text-ink-800 leading-relaxed">
          <p>
            <b>השיפוט פתוח לשופטות שהצוות מינה.</b> מנטורית שרוצה לעזור בשיפוט - כתבי לצוות.
          </p>
          <Link href="/hackathon" className="inline-flex mt-3 font-display font-bold text-brand-purple hover:underline">
            לדף ההאקתון ←
          </Link>
        </section>
      </div>
    );
  }
  const preview = !access.restricted && (await searchParams).as === PREVIEW;
  const restricted = access.restricted || preview;
  const { entries: loaded } = await loadJudgingBoard(profile);
  // The preview strips what a judge never gets: the automated report, the other judges, the ranking.
  const entries: JudgingEntry[] = preview
    ? loaded.map((e) => ({ ...e, report: null, reportUpdatedAt: null, scores: e.mine ? [e.mine] : [], average: null, gap: false, rank: null }))
    : loaded;
  const mineDone = entries.filter((e) => e.mine).length;
  const myChallenges = access.challengeKeys.length ? access.challengeKeys.map((k) => CHALLENGES.find((c) => c.key === k)?.short ?? k).join(" · ") : null;
  if (access.restricted && !myChallenges) {
    return (
      <div className="flex flex-col gap-5 max-w-5xl">
        <H26Style />
        <Header subtitle="מונית לשופטת - הצוות עוד לא שיבץ אותך לאתגר." />
        <section className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-[14px] text-ink-800 leading-relaxed" data-testid="judge-unassigned">
          <b>עוד לא שובצת לאתגר.</b> ברגע שהצוות ישבץ אותך, ההגשות של האתגר יופיעו כאן.
        </section>
      </div>
    );
  }
  const challengesLine = myChallenges ?? "כל האתגרים";
  return (
    <div className="flex flex-col gap-5 max-w-6xl">
      <H26Style />
      {/* The desk needs room: a rail beside the card, the report beside the team's text. The member shell centres every page
          in 780px; this page alone widens it (an unlayered rule beats the utility class). */}
      <style>{`[data-shell-main]{max-width:1240px}`}</style>
      <Header
        subtitle={
          restricted
            ? `ההגשות של ${challengesLine}: המוצר החי, הקוד, הסרטון, מה שהצוות כתב - והציון שלך. את רואה רק את הציונים שלך.`
            : "כל ההגשות: המוצר החי, הקוד, הסרטון, הבדיקה האוטומטית, כל הציונים - והציון שלך."
        }
      />
      {preview && (
        <div className="rounded-[14px] border border-brand-purple/30 bg-tint-purple/40 px-4 py-2.5 text-[13px] text-ink-900 flex items-center gap-3 flex-wrap" data-testid="judge-preview">
          <b>את רואה את הדף כמו שופטת:</b> בלי הבדיקה האוטומטית, בלי ציונים של אחרות. ציון שתשמרי כאן נשמר על שמך.
          <Link href="/judge" className="ms-auto font-bold text-brand-purple hover:underline" data-testid="judge-preview-off">
            חזרה לתצוגה שלך ←
          </Link>
        </div>
      )}
      {!restricted && (
        <div className="text-[12.5px] text-ink-600 -mt-2">
          <Link href="/judge?as=judge" className="font-semibold text-brand-purple hover:underline" data-testid="judge-preview-on">
            להציג את הדף כמו שופטת ←
          </Link>
        </div>
      )}
      <section className="relative overflow-hidden rounded-[22px] bg-brand-gradient text-white px-6 py-5 shadow-glow-pink flex items-center gap-5 flex-wrap">
        <span className="absolute -top-6 -start-4 text-[120px] opacity-10 select-none" aria-hidden>
          ⚖️
        </span>
        <div className="relative flex-1 min-w-[240px]">
          <div className="font-mono text-[11.5px] text-white/80">&lt;הרובריקה/&gt;</div>
          <div className="font-display font-black text-[20px] leading-snug mt-1">100 נקודות, שישה קריטריונים</div>
          <div className="text-[12.5px] text-white/90 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {CRITERIA.map((c) => (
              <span key={c.key}>
                {c.label} <b>{c.max}</b>
              </span>
            ))}
          </div>
          <div className="text-[12px] text-white/80 mt-1">נכונות מתחת ל-10 מגבילה את הציון ל-60. מערכת שממציאה לא יכולה לזכות. על כל קריטריון אפשר לכתוב הערה.</div>
        </div>
        <div className="relative text-center">
          <div className="font-display font-black text-[30px] leading-none">
            {mineDone}
            <span className="text-[16px] text-white/80"> / {entries.length}</span>
          </div>
          <div className="text-[12px] text-white/85 mt-1">הגשות ששפטת</div>
        </div>
      </section>
      {restricted && <JudgeGuide />}
      <JudgingDesk entries={entries} viewerId={profile.id} manage={!restricted} />
    </div>
  );
}

/** What to do, in four steps (26/10: a judge wrote "לא ברור לי מה לעשות"). */
function JudgeGuide() {
  const steps = [
    ["בוחרים פרויקט", "ברשימה שבצד, או עם ״הבאה״. מספר הפרויקטים שכבר שפטת מופיע למעלה."],
    ["מתרשמים", "צופים בסרטון, פותחים את ״המוצר החי״ ואת הקוד, וקוראים מה הצוות כתב על הארכיטקטורה והפיצ׳ר המקורי."],
    ["מנקדים", "בששת הקריטריונים, כל אחד עד המקסימום שלו. על כל קריטריון אפשר להוסיף משפט לצוות - הוא יגיע אליו."],
    ["שומרים וממשיכים", "״שמירת הציון״ ואז ״הבאה״. אפשר לחזור לכל פרויקט ולעדכן את הציון עד סוף השיפוט."],
  ];
  return (
    <section className="bg-white border border-ink-200 rounded-[18px] px-5 py-4 shadow-sm" data-testid="judge-guide">
      <div className="font-mono text-[12px] text-brand-pink-deep">{"// איך שופטים"}</div>
      <ol className="mt-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-5 gap-y-3 text-[13px] text-ink-800">
        {steps.map(([title, body], i) => (
          <li key={title} className="flex items-start gap-2.5">
            <span className="shrink-0 h-6 w-6 rounded-full bg-brand-gradient text-white text-[12px] font-black inline-flex items-center justify-center">{i + 1}</span>
            <span>
              <b className="text-ink-1000">{title}.</b> {body}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-end justify-between gap-5 flex-wrap">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;שיפוט/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1 flex items-center gap-2 flex-wrap">
          <Gavel size={24} className="text-brand-pink-deep" />
          שיפוט{" "}
          <span className="text-[20px]">
            האקתון{" "}
            <span className="relative inline-block">
              <span className="t-gradient">AI</span>
              <Squiggle className="absolute -bottom-0.5 right-0 w-full" />
            </span>{" "}
            2026
          </span>
        </h1>
        <p className="t-body-sm text-ink-700 mt-1">{subtitle}</p>
      </div>
      <HackathonLogo animate={false} className="block w-[170px] shrink-0" />
    </div>
  );
}
