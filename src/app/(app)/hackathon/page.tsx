import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, FileDown, Lock, Sparkles, Trophy, Users } from "lucide-react";
import { requireCommunityAccess, isSubscriber } from "@/lib/auth";
import { CHALLENGES, HACKATHON_UPDATES } from "@/app/hackathon-2026/shared";
import { loadMaterials, loadMyRegistration, loadPairCandidates, loadRegistrationCounts, registrableChallenges } from "@/lib/hackathon";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = { title: "האקתון" };
export const dynamic = "force-dynamic";

/**
 * The in-community hackathon page (the owner, 5/10: "יותר נח ונקי אבל עדיין
 * מגניב"): a calm layout - one gradient header, a short "what's new" strip,
 * challenge cards in a grid, and the registration card. The playful public
 * page keeps the sparkles; here the content leads.
 */
export default async function HackathonPage({ searchParams }: { searchParams: Promise<{ challenge?: string }> }) {
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);
  const { challenge: preselect } = await searchParams;
  const [registration, candidates, materials, counts] = subscriber
    ? await Promise.all([loadMyRegistration(profile.id), loadPairCandidates(profile.id), loadMaterials(), loadRegistrationCounts()])
    : [null, [], [], {} as Record<string, number>];
  const materialsByKey = new Map<string, number>();
  for (const m of materials) materialsByKey.set(m.challenge_key, (materialsByKey.get(m.challenge_key) ?? 0) + 1);
  const myChallenge = registration ? CHALLENGES.find((c) => c.key === registration.challengeKey) : null;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* ── header ── */}
      <section className="relative overflow-hidden bg-brand-gradient rounded-[24px] p-6 sm:p-8 text-white shadow-glow-pink">
        <Sparkles className="absolute top-5 left-6 w-5 h-5 opacity-70" aria-hidden />
        <span className="font-mono text-[12px] opacity-80">&lt;האקתון/&gt;</span>
        <h1 className="font-display text-[30px] sm:text-[34px] font-black leading-tight mt-1">האקתון AI קוד פתוח 2026</h1>
        <p className="text-[15px] opacity-90 mt-1.5 max-w-xl">
          את בוחרת אתגר אמיתי מהתעשייה, בונה מנוע AI וממשק, ועולה על הבמה בערב הגמר.
        </p>
        <div className="flex items-center gap-2 flex-wrap mt-4">
          <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/30 px-3 py-1 rounded-full text-[13px] font-bold">
            <CalendarDays size={14} /> ערב גמר · יום רביעי 28/10 · י״ז חשוון
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/30 px-3 py-1 rounded-full text-[13px] font-bold">
            <Trophy size={14} /> למנויות הקהילה
          </span>
          <a
            href="/hackathon-2026"
            target="_blank"
            rel="noopener noreferrer"
            className="ms-auto inline-flex items-center gap-1.5 bg-white text-brand-purple font-display font-bold text-[13.5px] px-4 py-1.5 rounded-full hover:bg-tint-purple transition-colors"
          >
            לדף האירוע המלא <ArrowLeft size={14} />
          </a>
        </div>
      </section>

      {/* ── what's new ── */}
      <section className="bg-white border border-ink-200 rounded-[18px] px-5 py-4 shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-bold text-[15px] text-ink-1000">מה חדש</h2>
          <span className="rounded-full bg-brand-gradient text-white text-[10.5px] font-bold px-2 py-0.5">חדש</span>
        </div>
        <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {HACKATHON_UPDATES.map((u) => (
            <li key={u.text} className="flex items-start gap-2 text-[13.5px] text-ink-800">
              <span className="font-mono text-[11.5px] text-ink-500 mt-0.5 shrink-0">{u.date}</span>
              <span>{u.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── my registration, at a glance ── */}
      {subscriber && registration && myChallenge && (
        <section className="bg-tint-mint/60 border border-[#1B7A4B]/30 rounded-[18px] px-5 py-3.5 flex items-center gap-3 flex-wrap">
          <span className="text-[14px] text-ink-900">
            ✓ את רשומה לאתגר <b>{myChallenge.short}</b>
            {registration.partner ? ` יחד עם ${registration.partner.name}` : " (לבד)"}
          </span>
          <Link href={`/hackathon/${myChallenge.key}`} className="ms-auto text-[13px] font-bold text-brand-purple hover:underline">
            לדף האתגר והחומרים ←
          </Link>
        </section>
      )}

      {/* ── the challenges ── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[20px] font-black text-ink-1000">האתגרים</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CHALLENGES.map((c, i) =>
            c.challenge && c.key ? (
              <article
                key={c.key}
                className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3 hover:border-brand-purple/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {c.badgeLogo && (
                    <span className="w-12 h-12 shrink-0 rounded-full overflow-hidden bg-white border border-ink-200 flex items-center justify-center p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.badgeLogo} alt={c.short} className="w-full h-full object-contain" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block font-display font-black text-[16.5px] leading-tight">{c.short}</span>
                    {c.org && <span className="block text-[12.5px] text-ink-500 mt-0.5">{c.org}</span>}
                  </span>
                </div>
                <p className="text-[13.5px] text-ink-800 leading-relaxed">{c.challenge}</p>
                <div className="mt-auto flex items-center gap-3 flex-wrap text-[12.5px] text-ink-600">
                  <Link
                    href={`/hackathon/${c.key}`}
                    className="inline-flex items-center gap-1.5 text-[13px] font-bold text-white bg-brand-gradient px-3.5 py-1.5 rounded-full hover:brightness-105"
                  >
                    לפרטי האתגר והחומרים <ArrowLeft size={13} />
                  </Link>
                  {(materialsByKey.get(c.key) ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <FileDown size={13} /> {materialsByKey.get(c.key)} קבצים
                    </span>
                  )}
                  {subscriber && (counts[c.key] ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Users size={13} /> {counts[c.key]} רשומות
                    </span>
                  )}
                </div>
              </article>
            ) : (
              <div key={i} className={`${c.tint} border border-dashed border-ink-300 rounded-[18px] p-5 flex items-center gap-3`}>
                {c.badgeLogo ? (
                  <span className="w-12 h-12 shrink-0 rounded-full overflow-hidden bg-white border border-ink-200 flex items-center justify-center p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.badgeLogo} alt={c.short} className="w-full h-full object-contain" />
                  </span>
                ) : (
                  <span className="w-12 h-12 shrink-0 rounded-full bg-white border border-ink-200 text-[20px] flex items-center justify-center">{c.emoji}</span>
                )}
                <span>
                  <span className="block font-display font-bold text-[15px] text-ink-700">{c.short}</span>
                  <span className="block text-[12.5px] text-ink-500">{c.teaser ?? "האתגר בדרך…"}</span>
                </span>
              </div>
            )
          )}
        </div>
      </section>

      {/* ── registration ── */}
      <section id="register" className="bg-white border border-ink-200 rounded-[18px] p-5 sm:p-6 shadow-sm scroll-mt-4">
        <h2 className="font-display text-[18px] font-black text-ink-1000 flex items-center gap-2">
          {subscriber ? <Trophy size={18} className="text-brand-purple" /> : <Lock size={16} className="text-ink-400" />}
          {registration ? "ההרשמה שלך" : "הרשמה לאתגר"}
        </h2>
        {subscriber ? (
          <>
            <p className="text-[13.5px] text-ink-600 mt-1 mb-4">אתגר אחד, לבד או כזוג חברות. אפשר להחליף בכל רגע עד האירוע.</p>
            <RegistrationForm
              challenges={registrableChallenges().map((c) => ({ key: c.key!, short: c.short, org: c.org }))}
              candidates={candidates}
              current={registration}
              preselect={preselect}
            />
          </>
        ) : (
          <>
            <p className="text-[13.5px] text-ink-700 mt-1">ההשתתפות בהאקתון, בחירת האתגר והורדת החומרים - למנויות הקהילה.</p>
            <Link
              href="/join"
              className="inline-flex items-center gap-1.5 mt-3 text-[13.5px] font-bold text-white bg-brand-gradient px-4 py-2 rounded-full hover:brightness-105 transition-[filter]"
            >
              רוצה להשתתף? הצטרפי 💜 <ArrowLeft size={14} />
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
