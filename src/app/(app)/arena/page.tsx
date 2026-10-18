import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui";
import { requireCommunityAccess } from "@/lib/auth";
import { arenaLeaderboard, arenaRoleFor, loadArenaMentors, loadArenaQuestions, mentorArenaStats } from "@/lib/arena";
import { ARENA_ANSWER_POINTS, ARENA_HELPFUL_POINTS } from "@/lib/arena-shared";
import { loadMyRegistration, registrableChallenges } from "@/lib/hackathon";
import { CHALLENGES, H26Style, HackathonLogo, Squiggle } from "@/app/hackathon-2026/shared";
import { AskForm } from "./ask-form";
import { ArenaBoard } from "./arena-board";
import { PresenceToggle } from "./presence-toggle";

export const metadata: Metadata = { title: "זירת המנטוריות" };
export const dynamic = "force-dynamic";

/**
 * זירת המנטוריות (the owner, 15/10 + 16/10): hackathon registrants ask - a
 * random mentor (present ones first), a random mentor who knows AI, or a
 * chosen one; every mentor sees every question, answers, earns points - and
 * a bonus when the asker marks "עזר לי". Dressed in the hackathon's own
 * elements.
 */
export default async function ArenaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await requireCommunityAccess();
  const role = await arenaRoleFor(profile);
  const { q: focusId } = await searchParams;
  const challenges = registrableChallenges();

  if (!role) {
    return (
      <div className="flex flex-col gap-5 max-w-4xl">
        <H26Style />
        <Header subtitle="שאלות למנטוריות - לרשומות להאקתון." />
        <section className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-[14px] text-ink-800 leading-relaxed">
          <p>
            <b>הזירה פתוחה לרשומות להאקתון ולמנטוריות.</b> ברגע שנרשמת לאתגר (לבד או כזוג מאושר), הזירה נפתחת לך: שאלה
            שמגיעה לכל המנטוריות, ומי שיכולה עונה - והתשובה מגיעה גם למייל.
          </p>
          <Link href="/hackathon" className="inline-flex mt-3 font-display font-bold text-brand-purple hover:underline">
            להרשמה להאקתון ←
          </Link>
        </section>
      </div>
    );
  }

  const isMentorSide = role !== "participant";
  const [questions, mentors, registration] = await Promise.all([
    loadArenaQuestions({ id: profile.id, role }),
    loadArenaMentors(),
    isMentorSide ? Promise.resolve(null) : loadMyRegistration(profile.id),
  ]);
  const [stats, leaders] = isMentorSide ? await Promise.all([mentorArenaStats(profile.id), arenaLeaderboard(5)]) : [null, []];
  const open = questions.filter((q) => q.status === "open").length;
  const myChallenge = registration ? (CHALLENGES.find((c) => c.key === registration.challengeKey) ?? null) : null;
  const me = mentors.find((m) => m.id === profile.id) ?? null;
  const presentNow = mentors.filter((m) => m.present && m.available).length;

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <H26Style />
      <Header
        subtitle={
          isMentorSide
            ? "כל השאלות של כל הצוותים בהאקתון, במקום אחד. אף שאלה לא ממוענת - מי שיכולה, עונה. תשובה ראשונה = נקודות, ועוד בונוס כשהיא עזרה."
            : "השאלה מגיעה לכל המנטוריות בזירה, ומי שיכולה עונה. התשובה מגיעה גם למייל."
        }
      />

      {/* ── the hackathon strip ── */}
      <section className="bg-white border border-ink-200 rounded-[18px] px-5 py-3 shadow-sm flex items-center gap-x-5 gap-y-2 flex-wrap">
        <span className="font-display font-bold text-[13.5px] text-ink-1000 inline-flex items-center gap-1.5">
          <Trophy size={15} className="text-brand-pink-deep" /> האתגרים בזירה
        </span>
        {challenges.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-2 text-[13px] text-ink-800">
            {c.badgeLogo ? (
              <Image src={c.badgeLogo} alt="" width={26} height={26} className="h-[26px] w-[26px] rounded-full object-contain bg-white border border-ink-200" />
            ) : (
              <span className="text-[18px]">{c.emoji}</span>
            )}
            <span>{c.short}</span>
          </span>
        ))}
        <span className="ms-auto inline-flex items-center gap-1.5 bg-tint-purple text-brand-purple px-3 py-1 rounded-full text-[12.5px] font-bold">
          <CalendarDays size={13} /> גמר · יום רביעי 28/10 · י״ז חשוון · היכל התרבות רמות, ירושלים
        </span>
      </section>

      {isMentorSide && stats && (
        <section className="relative overflow-hidden rounded-[22px] bg-brand-gradient text-white p-5 md:p-6 shadow-glow-pink">
          <span className="absolute -top-6 -start-4 text-[120px] opacity-10 select-none" aria-hidden>
            🏆
          </span>
          <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex-1 min-w-[220px]">
              <div className="font-mono text-[11.5px] text-white/80">&lt;הנקודות שלך/&gt;</div>
              <div className="font-display text-[26px] md:text-[30px] font-black leading-tight mt-1">
                תשובה ראשונה = +{ARENA_ANSWER_POINTS}{" "}נק׳ · ״עזר לי״ = +{ARENA_HELPFUL_POINTS} 🏆
              </div>
              <p className="text-[13.5px] text-white/90 mt-1.5">
                נספרת פעם אחת לכל שאלה, ונכנסת לניקוד המנטוריות שלך שגלוי לכל הקהילה. הבונוס מגיע כשהשואלת מסמנת שהתשובה עזרה.
              </p>
            </div>
            <dl className="grid grid-cols-4 gap-2.5 text-center">
              <Stat label="תשובות" value={stats.arenaAnswers} />
              <Stat label="עזרו ✓" value={stats.helpful} />
              <Stat label="נק׳ מהזירה" value={stats.arenaPoints} />
              <Stat label="נק׳ סה״כ" value={stats.totalScore} />
            </dl>
          </div>
          <div className="relative mt-4 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="rounded-full bg-white/20 px-3 py-1 font-semibold">{open} שאלות פתוחות</span>
            {role === "mentor" && <PresenceToggle present={!!me?.present} until={me?.presentUntil ?? null} />}
            {leaders.length > 0 && (
              <span className="ms-auto flex items-center gap-2 flex-wrap">
                <Trophy size={14} className="text-white/90" />
                <span className="text-white/90 font-semibold">המובילות:</span>
                {leaders.map((l, i) => (
                  <span key={l.id} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                    <Avatar size="xs" initials={l.initials} />
                    <span>
                      {i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}
                      {l.name}
                    </span>
                    <span className="text-white/80">
                      · {l.points} נק׳{l.helpful ? ` · ${l.helpful} עזרו` : ""}
                    </span>
                  </span>
                ))}
              </span>
            )}
          </div>
        </section>
      )}

      {!isMentorSide && (
        <section className="relative overflow-hidden rounded-[22px] bg-brand-gradient text-white px-6 py-5 shadow-glow-pink flex items-center gap-3 flex-wrap">
          <span className="absolute -top-6 -start-4 text-[120px] opacity-10 select-none" aria-hidden>
            {myChallenge?.emoji ?? "🏆"}
          </span>
          <div className="relative font-display font-black text-[19px] leading-snug">
            {myChallenge ? (
              <>
                את באתגר <span className="underline decoration-white/60 underline-offset-4">{myChallenge.short}</span> {myChallenge.emoji} · המנטוריות כאן בשבילך
              </>
            ) : (
              <>האקתון AI קוד פתוח 2026 · המנטוריות כאן בשבילך 🏆</>
            )}
          </div>
          <div className="relative flex items-center gap-2 flex-wrap ms-auto text-[13px]">
            {presentNow > 0 && <span className="bg-white text-success px-3 py-1 rounded-full font-bold">🟢 {presentNow} כאן עכשיו</span>}
            <span className="bg-white/15 border border-white/30 px-3 py-1 rounded-full font-bold">{mentors.filter((m) => m.available).length} מנטוריות זמינות</span>
            <span className="bg-white/15 border border-white/30 px-3 py-1 rounded-full font-bold">{mentors.filter((m) => m.available && m.ai).length} מבינות ב-AI 🤖</span>
            {myChallenge && (
              <Link href={`/hackathon/${myChallenge.key}`} className="bg-white text-brand-purple px-3 py-1 rounded-full font-display font-bold hover:bg-tint-purple">
                לדף האתגר ←
              </Link>
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
    <div className="flex items-end justify-between gap-5 flex-wrap">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;זירת המנטוריות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">
          זירת המנטוריות 🏟️{" "}
          <span className="text-ink-400 font-bold text-[20px]">·</span>{" "}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] bg-white/15 px-2.5 py-2 min-w-[72px]">
      <dt className="text-[11px] text-white/80">{label}</dt>
      <dd className="font-display text-[22px] font-black tabular-nums leading-tight">{value}</dd>
    </div>
  );
}
