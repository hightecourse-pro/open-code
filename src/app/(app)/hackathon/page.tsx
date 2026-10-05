import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileDown, Lock, Sparkles } from "lucide-react";
import { requireCommunityAccess, isSubscriber } from "@/lib/auth";
import { CHALLENGES, HACKATHON_UPDATES, H26Style, Sparkle, Squiggle, SwirlArrow } from "@/app/hackathon-2026/shared";
import { loadMaterials, loadMyRegistration, loadPairCandidates, loadRegistrationCounts, registrableChallenges } from "@/lib/hackathon";
import { RegistrationForm } from "./registration-form";

export const metadata: Metadata = { title: "האקתון" };
export const dynamic = "force-dynamic";

/**
 * The in-community hackathon page (the owner, 7/9 + 5/10): the challenges,
 * what changed lately, and - for subscribers - registration (alone or as a
 * pair) and each challenge's page with its materials.
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

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <H26Style />

      {/* ── header ── */}
      <div className="relative">
        <Sparkle className="absolute -top-1 left-[30%] w-4 h-4" color="#F0B429" delay="0.8s" />
        <span className="font-mono text-xs text-brand-pink-deep">&lt;האקתון/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">
          האקתון{" "}
          <span className="relative inline-block">
            <span className="t-gradient">AI</span>
            <Squiggle className="absolute -bottom-1.5 right-0 w-full" />
          </span>{" "}
          קוד פתוח 2026
        </h1>
        <p className="t-body-sm text-ink-700 mt-1">אתגרים אמיתיים מהתעשייה - ובמה להוכיח מה את באמת יודעת.</p>
      </div>

      {/* ── what's new ── */}
      <section
        className="relative bg-white border-2 border-brand-pink/40 shadow-[3px_4px_0_0_#F3C6DD] p-4 rotate-[0.3deg]"
        style={{ borderRadius: "18px 24px 16px 22px" }}
      >
        <h2 className="font-display font-black text-[16px] text-ink-1000 flex items-center gap-2">
          <Sparkles size={16} className="text-brand-pink-deep" /> מה חדש בהאקתון
          <span className="rounded-full bg-brand-gradient text-white text-[10.5px] font-bold px-2 py-0.5">חדש</span>
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {HACKATHON_UPDATES.map((u) => (
            <li key={u.text} className="flex items-start gap-2 text-[13.5px] text-ink-800">
              <span className="font-mono text-[11.5px] text-ink-500 mt-0.5 shrink-0">{u.date}</span>
              <span>{u.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── the promise, loud ── */}
      <div className="relative overflow-hidden bg-brand-gradient rounded-[22px] p-6 text-white shadow-glow-pink -rotate-[0.5deg]">
        <Sparkle className="absolute top-3 left-6 w-5 h-5" color="#FFFFFF" />
        <Sparkle className="absolute bottom-4 right-8 w-4 h-4" color="#F8D98C" delay="1.1s" />
        <div className="font-display font-black text-[22px] leading-snug">את בוחרת אתגר. בונה מנוע AI וממשק. עולה על הבמה 🏆</div>
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <span className="bg-white/15 border border-white/30 px-3 py-1 rounded-full text-[13px] font-bold">💜 למנויות הקהילה</span>
          <a
            href="/hackathon-2026"
            target="_blank"
            rel="noopener noreferrer"
            className="ms-auto inline-flex items-center gap-1.5 bg-white text-brand-purple font-display font-bold text-[13.5px] px-4 py-1.5 rounded-full hover:bg-tint-purple transition-colors"
          >
            לדף האירוע המלא <ArrowLeft size={14} />
          </a>
        </div>
      </div>

      {/* ── the challenges ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-end gap-1">
          <h2 className="font-display text-[20px] font-black text-ink-1000 -rotate-1">
            האתגרים
            <Squiggle className="block w-20 -mt-0.5" />
          </h2>
          <SwirlArrow className="h26-float w-10 h-9 mb-1" color="#E0418D" />
        </div>

        {CHALLENGES.map((c, i) =>
          c.challenge && c.key ? (
            <div
              key={c.key}
              className="bg-white border-2 border-ink-900/10 shadow-[3px_4px_0_0_#F3C6DD] transition-all md:-rotate-[0.6deg] hover:rotate-0 p-4 flex items-start gap-3"
              style={{ borderRadius: "18px 22px 16px 24px" }}
            >
              {c.badgeLogo && (
                <span className="w-12 h-12 shrink-0 -rotate-6 rounded-full overflow-hidden bg-white border-2 border-brand-pink/30 shadow-sm flex items-center justify-center p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.badgeLogo} alt={c.short} className="w-full h-full object-contain" />
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className="block font-display font-black text-[16px] leading-tight">{c.short}</span>
                {c.org && <span className="block text-[12.5px] text-ink-500 mt-0.5">{c.org}</span>}
                <span className="block t-body-sm text-ink-800 mt-1.5">{c.challenge}</span>
                <span className="flex items-center gap-2 flex-wrap mt-2.5">
                  <Link
                    href={`/hackathon/${c.key}`}
                    className="inline-flex items-center gap-1.5 text-[13px] font-bold text-white bg-brand-gradient px-3.5 py-1.5 rounded-full hover:brightness-105"
                  >
                    לפרטי האתגר והחומרים <ArrowLeft size={13} />
                  </Link>
                  {(materialsByKey.get(c.key) ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-ink-600">
                      <FileDown size={13} /> {materialsByKey.get(c.key)} קבצים להורדה
                    </span>
                  )}
                  {subscriber && (counts[c.key] ?? 0) > 0 && (
                    <span className="text-[12px] text-ink-500">{counts[c.key]} רשומות</span>
                  )}
                </span>
              </span>
            </div>
          ) : (
            <div
              key={i}
              className={`${c.tint} border-2 border-dashed border-ink-300/70 p-3.5 flex items-center gap-3 md:rotate-[0.5deg]`}
              style={{ borderRadius: "20px 16px 22px 18px" }}
            >
              {c.badgeLogo ? (
                <span className="w-12 h-12 shrink-0 rotate-3 rounded-full overflow-hidden bg-white border-2 border-ink-100 shadow-sm flex items-center justify-center p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.badgeLogo} alt={c.short} className="w-full h-full object-contain" />
                </span>
              ) : (
                <span
                  className="w-10 h-10 bg-white border border-ink-200 text-[18px] flex items-center justify-center shrink-0 rotate-6"
                  style={{ borderRadius: "50% 46% 54% 50% / 45% 55% 52% 48%" }}
                >
                  <span className="h26-wiggle" style={{ animationDelay: `${i * 0.5}s` }}>
                    {c.emoji}
                  </span>
                </span>
              )}
              <span className="flex-1">
                <span className="block font-display font-bold text-[14.5px] text-ink-700">{c.short}</span>
                <span className="block text-[12px] text-ink-400">{c.teaser ?? "האתגר בדרך…"}</span>
              </span>
            </div>
          )
        )}
      </section>

      {/* ── registration: subscribers only ── */}
      <section
        id="register"
        className={`relative border-2 p-5 scroll-mt-4 ${subscriber ? "bg-tint-purple/30 border-brand-purple/40" : "bg-ink-50 border-ink-200"}`}
        style={{ borderRadius: "24px 18px 26px 20px" }}
      >
        <Sparkle className="absolute -top-2.5 -right-2 w-6 h-6" color="#E0418D" />
        <h2 className="font-display text-[17px] font-black text-ink-1000 flex items-center gap-2">
          <Lock size={16} className={subscriber ? "text-brand-purple" : "text-ink-400"} />
          הרשמה לאתגר
        </h2>
        {subscriber ? (
          <>
            <p className="t-body-sm text-ink-700 mt-1.5 mb-4">
              בוחרים אתגר אחד, לבד או כזוג חברות. אפשר להחליף בכל רגע עד האירוע. החומרים של כל אתגר בדף שלו.
            </p>
            <RegistrationForm
              challenges={registrableChallenges().map((c) => ({ key: c.key!, short: c.short, org: c.org }))}
              candidates={candidates}
              current={registration}
              preselect={preselect}
            />
          </>
        ) : (
          <>
            <p className="t-body-sm text-ink-700 mt-1.5">ההשתתפות בהאקתון, בחירת האתגר והורדת החומרים - למנויות הקהילה.</p>
            <p className="font-display font-bold text-[15px] text-ink-1000 mt-2">רוצה להשתתף? הצטרפי 💜</p>
            <Link
              href="/join"
              className="inline-flex items-center gap-1.5 mt-2.5 text-[13.5px] font-bold text-white bg-brand-gradient px-4 py-2 rounded-full hover:brightness-105 transition-[filter]"
            >
              להצטרפות <ArrowLeft size={14} />
            </Link>
          </>
        )}
      </section>

      {/* ── the finale tease ── */}
      <div
        className="relative overflow-hidden bg-white border-2 border-ink-900/10 shadow-[4px_5px_0_0_#DDC9EC] p-5 text-center rotate-[0.5deg]"
        style={{ borderRadius: "20px 26px 18px 24px" }}
      >
        <Sparkle className="absolute top-3 right-5 w-4 h-4" delay="0.4s" />
        <Sparkle className="absolute bottom-3 left-6 w-4 h-4" color="#F0B429" delay="1.4s" />
        <div className="font-display font-black text-[17px] text-ink-1000">אירוע סיום נוצץ ✨</div>
        <p className="t-body-sm font-bold text-ink-900 mt-1">יום רביעי | 28/10 | י״ז חשוון</p>
        <p className="t-body-sm text-ink-700 mt-1">
          הקהילה חוגגת, והזוכות עולות לבמה 🏆 כל הפרטים, ההכנה והצעדים{" "}
          <a href="/hackathon-2026" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-purple hover:underline">
            בדף האירוע המלא
          </a>
          .
        </p>
      </div>
    </div>
  );
}
