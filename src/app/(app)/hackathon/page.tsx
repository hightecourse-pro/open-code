import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileDown, Lock } from "lucide-react";
import { requireCommunityAccess, isSubscriber } from "@/lib/auth";
import { CHALLENGES, H26Style, Sparkle, Squiggle, SwirlArrow } from "@/app/hackathon-2026/shared";

export const metadata: Metadata = { title: "האקתון" };

/**
 * The in-community hackathon page (the owner, 7/9): community design, still
 * playful. The challenges live here, the full story lives on /hackathon-2026
 * (the members' page - NOT the partners one). The challenge-pick form is not
 * open yet; picking + downloading materials is for paid subscribers only.
 */
export default async function HackathonPage() {
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);

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
        <p className="t-body-sm text-ink-700 mt-1">
          אתגרים אמיתיים מהתעשייה, מנטוריות שמלוות - ובמה להוכיח מה את באמת יודעת.
        </p>
      </div>

      {/* ── the promise, loud ── */}
      <div className="relative overflow-hidden bg-brand-gradient rounded-[22px] p-6 text-white shadow-glow-pink -rotate-[0.5deg]">
        <Sparkle className="absolute top-3 left-6 w-5 h-5" color="#FFFFFF" />
        <Sparkle className="absolute bottom-4 right-8 w-4 h-4" color="#F8D98C" delay="1.1s" />
        <div className="font-display font-black text-[22px] leading-snug">
          את בוחרת אתגר. בונה מנוע AI וממשק. עולה על הבמה 🏆
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-3">
          <span className="bg-white/15 border border-white/30 px-3 py-1 rounded-full text-[13px] font-bold">
            📅 אחרי החגים
          </span>
          <span className="bg-white/15 border border-white/30 px-3 py-1 rounded-full text-[13px] font-bold">
            💜 למנויות הקהילה
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
          c.challenge ? (
            <details
              key={i}
              className="group bg-white border-2 border-ink-900/10 shadow-[3px_4px_0_0_#F3C6DD] open:border-brand-pink transition-all md:-rotate-[0.6deg] hover:rotate-0"
              style={{ borderRadius: "18px 22px 16px 24px" }}
            >
              <summary className="list-none cursor-pointer p-4 flex items-center gap-3 [&::-webkit-details-marker]:hidden">
                {c.badgeLogo && (
                  <span className="w-12 h-12 shrink-0 -rotate-6 rounded-full overflow-hidden bg-white border-2 border-brand-pink/30 shadow-sm flex items-center justify-center p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.badgeLogo} alt={c.short} className="w-full h-full object-contain" />
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block font-display font-black text-[16px] leading-tight">{c.short}</span>
                  {c.org && <span className="block text-[12.5px] text-ink-500 mt-0.5">{c.org}</span>}
                </span>
                <span className="font-mono text-brand-pink-deep text-sm group-open:rotate-90 transition-transform">&gt;</span>
              </summary>
              <div className="px-4 pb-4 pt-0 flex flex-col gap-2.5">
                <p className="t-body-sm text-ink-900 leading-relaxed">{c.challenge}</p>
                {c.partnerLogo && (
                  <span className="self-center bg-white border border-ink-100 rounded-[12px] px-4 py-2 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.partnerLogo} alt={c.org ?? ""} className="h-12 w-auto max-w-full" />
                  </span>
                )}
              </div>
            </details>
          ) : (
            <div
              key={i}
              className={`${c.tint} border-2 border-dashed border-ink-300/70 p-3.5 flex items-center gap-3 md:rotate-[0.5deg]`}
              style={{ borderRadius: "20px 16px 22px 18px" }}
            >
              <span
                className="w-10 h-10 bg-white border border-ink-200 text-[18px] flex items-center justify-center shrink-0 rotate-6"
                style={{ borderRadius: "50% 46% 54% 50% / 45% 55% 52% 48%" }}
              >
                <span className="h26-wiggle" style={{ animationDelay: `${i * 0.5}s` }}>{c.emoji}</span>
              </span>
              <span className="flex-1">
                <span className="block font-display font-bold text-[14.5px] text-ink-500">{c.short}</span>
                <span className="block text-[12px] text-ink-400">האתגר בדרך…</span>
              </span>
            </div>
          )
        )}
      </section>

      {/* ── picking a challenge: not open yet, subscribers only ── */}
      <section
        className={`relative border-2 p-5 ${subscriber ? "bg-tint-purple/30 border-brand-purple/40" : "bg-ink-50 border-ink-200"}`}
        style={{ borderRadius: "24px 18px 26px 20px" }}
      >
        <Sparkle className="absolute -top-2.5 -right-2 w-6 h-6" color="#E0418D" />
        <h2 className="font-display text-[17px] font-black text-ink-1000 flex items-center gap-2">
          <Lock size={16} className={subscriber ? "text-brand-purple" : "text-ink-400"} />
          בחירת אתגר והורדת חומרים
        </h2>
        {subscriber ? (
          <>
            <p className="t-body-sm text-ink-700 mt-1.5">
              טופס בחירת האתגר ייפתח כאן ממש בקרוב - ויחד איתו יעלו חומרי האתגרים להורדה.
              שווה כבר עכשיו לבחור בלב איזה אתגר מדליק אותך 😉
            </p>
            <div className="flex items-center gap-2.5 flex-wrap mt-3">
              <span
                className="h26-bounce inline-flex items-center gap-2 bg-white border-2 border-dashed border-brand-pink/50 px-5 py-2.5 font-display font-bold text-[14px] text-ink-700 -rotate-1 shadow-[3px_4px_0_0_#F3C6DD]"
                style={{ borderRadius: "999px" }}
              >
                🔒 הטופס ייפתח בקרוב
              </span>
              <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-500">
                <FileDown size={14} /> חומרי האתגרים - יעלו עם פתיחת הטופס
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="t-body-sm text-ink-700 mt-1.5">
              בחירת אתגר, הורדת החומרים וההשתתפות בהאקתון פתוחות למנויות הקהילה בלבד 💜
            </p>
            <Link
              href="/join"
              className="inline-flex items-center gap-1.5 mt-3 text-[13.5px] font-bold text-white bg-brand-gradient px-4 py-2 rounded-full hover:brightness-105 transition-[filter]"
            >
              לשדרוג המנוי <ArrowLeft size={14} />
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
        <p className="t-body-sm text-ink-700 mt-1">
          באמצע חשוון - הקהילה חוגגת, והזוכות עולות לבמה 🏆 כל הפרטים, ההכנה והצעדים{" "}
          <a href="/hackathon-2026" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-purple hover:underline">
            בדף האירוע המלא
          </a>
          .
        </p>
      </div>
    </div>
  );
}
