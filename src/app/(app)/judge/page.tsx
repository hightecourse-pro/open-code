import type { Metadata } from "next";
import Link from "next/link";
import { Gavel } from "lucide-react";
import { requireCommunityAccess } from "@/lib/auth";
import { isJudge, loadJudgingBoard } from "@/lib/judging";
import { CRITERIA } from "@/lib/judging-shared";
import { H26Style, HackathonLogo, Squiggle } from "@/app/hackathon-2026/shared";
import { JudgingBoard } from "./judging-board";

export const metadata: Metadata = { title: "שיפוט ההאקתון" };
export const dynamic = "force-dynamic";

/**
 * שיפוט ההאקתון (the owner, 16/10): the mentors she appoints (and the team)
 * score every submitted team on the rubric, next to the automated check
 * report. A judge sees only her own scores.
 */
export default async function JudgePage() {
  const profile = await requireCommunityAccess();
  if (!(await isJudge(profile))) {
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
  const { entries } = await loadJudgingBoard(profile);
  const mineDone = entries.filter((e) => e.mine).length;
  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <H26Style />
      <Header subtitle="כל הגשה: המוצר החי, הקוד, הסרטון, דשבורד הבדיקה האוטומטית - והציון שלך. את לא רואה ציונים של שופטות אחרות." />
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
          <div className="text-[12px] text-white/80 mt-1">נכונות מתחת ל-10 מגבילה את הציון ל-60. מערכת שממציאה לא יכולה לזכות.</div>
        </div>
        <div className="relative text-center">
          <div className="font-display font-black text-[30px] leading-none">
            {mineDone}
            <span className="text-[16px] text-white/80"> / {entries.length}</span>
          </div>
          <div className="text-[12px] text-white/85 mt-1">הגשות ששפטת</div>
        </div>
      </section>
      <JudgingBoard entries={entries} viewerId={profile.id} manage={profile.role === "admin"} />
    </div>
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
