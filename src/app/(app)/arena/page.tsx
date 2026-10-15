import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/ui";
import { requireCommunityAccess } from "@/lib/auth";
import { arenaLeaderboard, arenaRoleFor, loadArenaMentors, loadArenaQuestions, mentorArenaStats } from "@/lib/arena";
import { ARENA_ANSWER_POINTS } from "@/lib/arena-shared";
import { AskForm } from "./ask-form";
import { ArenaBoard } from "./arena-board";

export const metadata: Metadata = { title: "זירת המנטוריות" };
export const dynamic = "force-dynamic";

/**
 * זירת המנטוריות (the owner, 15/10): hackathon registrants ask - a random
 * mentor, a random mentor who knows AI, or a chosen one; every mentor sees
 * every question, answers, and sees plainly that answers earn points.
 */
export default async function ArenaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await requireCommunityAccess();
  const role = await arenaRoleFor(profile);
  const { q: focusId } = await searchParams;

  if (!role) {
    return (
      <div className="flex flex-col gap-5">
        <Header subtitle="שאלות למנטוריות - לרשומות להאקתון." />
        <section className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-[14px] text-ink-800 leading-relaxed">
          <p>
            <b>הזירה פתוחה לרשומות להאקתון ולמנטוריות.</b> ברגע שנרשמת לאתגר (לבד או כזוג מאושר), הזירה נפתחת לך: שאלה למנטורית
            אקראית, למנטורית שמבינה ב-AI, או למנטורית שתבחרי - והתשובה מגיעה גם למייל.
          </p>
          <Link href="/hackathon" className="inline-flex mt-3 font-display font-bold text-brand-purple hover:underline">
            להרשמה להאקתון ←
          </Link>
        </section>
      </div>
    );
  }

  const [questions, mentors] = await Promise.all([loadArenaQuestions(), loadArenaMentors()]);
  const isMentorSide = role !== "participant";
  const [stats, leaders] = isMentorSide ? await Promise.all([mentorArenaStats(profile.id), arenaLeaderboard(5)]) : [null, []];
  const open = questions.filter((q) => q.status === "open").length;
  const forMe = questions.filter((q) => q.status === "open" && q.targetMentorId === profile.id).length;

  return (
    <div className="flex flex-col gap-5">
      <Header
        subtitle={
          isMentorSide
            ? "כל השאלות של כל הצוותים בהאקתון, במקום אחד. תשובה ראשונה לשאלה = נקודות."
            : "שאלה למנטורית אקראית, למנטורית שמבינה ב-AI, או למי שתבחרי. התשובה מגיעה גם למייל."
        }
      />

      {isMentorSide && stats && (
        <section className="rounded-[22px] bg-brand-gradient text-white p-5 md:p-6 shadow-glow-pink">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex-1 min-w-[220px]">
              <div className="font-mono text-[11.5px] text-white/80">&lt;הנקודות שלך/&gt;</div>
              <div className="font-display text-[26px] md:text-[30px] font-black leading-tight mt-1">
                כל תשובה ראשונה לשאלה = +{ARENA_ANSWER_POINTS} נק&#39; 🏆
              </div>
              <p className="text-[13.5px] text-white/90 mt-1.5">
                נספרת פעם אחת לכל שאלה, ונכנסת לניקוד המנטוריות שלך שגלוי לכל הקהילה.
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <Stat label="תשובות בזירה" value={stats.arenaAnswers} />
              <Stat label="נק׳ מהזירה" value={stats.arenaPoints} />
              <Stat label="נק׳ סה״כ" value={stats.totalScore} />
            </dl>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">{open} שאלות פתוחות</span>
            {forMe > 0 && <span className="rounded-full bg-white text-brand-purple px-3 py-1 font-bold">{forMe} ממתינות לך אישית</span>}
            {leaders.length > 0 && (
              <span className="ms-auto flex items-center gap-2 flex-wrap">
                <Trophy size={14} className="text-white/90" />
                <span className="text-white/90 font-semibold">המובילות:</span>
                {leaders.map((l, i) => (
                  <span key={l.id} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                    <Avatar size="xs" initials={l.initials} />
                    <span>{i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}{l.name}</span>
                    <span className="text-white/80">· {l.points} נק׳</span>
                  </span>
                ))}
              </span>
            )}
          </div>
        </section>
      )}

      {!isMentorSide && <AskForm mentors={mentors.filter((m) => m.available)} />}

      <ArenaBoard questions={questions} viewerId={profile.id} role={role} focusId={focusId ?? null} />
    </div>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <div>
      <span className="font-mono text-xs text-brand-pink-deep">&lt;זירת המנטוריות/&gt;</span>
      <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">זירת המנטוריות 🏟️</h1>
      <p className="t-body-sm text-ink-700 mt-1">{subtitle}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] bg-white/15 px-3 py-2 min-w-[86px]">
      <dt className="text-[11px] text-white/80">{label}</dt>
      <dd className="font-display text-[22px] font-black tabular-nums leading-tight">{value}</dd>
    </div>
  );
}
