// The shared half of the hackathon 2026 pages: the main page and the
// partners page must stay IDENTICAL from the hero through the challenges
// (the owner, 6/9) — so hero, ticker, challenges, doodles and the animation
// styles live here and both routes render them from one source.
import Link from "next/link";
import { Logo } from "@/components/ui";

/* ---------------------------------------------------------------- doodles */

/** Hand-drawn squiggle underline. */
export function Squiggle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 12" fill="none" aria-hidden className={className}>
      <path
        d="M3 8 Q 13 2, 23 7 T 43 7 T 63 8 T 83 6 T 103 8 T 117 6"
        stroke="#E0418D"
        strokeWidth="3.5"
        strokeLinecap="round"
        className="h26-draw"
        style={{ strokeDasharray: 130, strokeDashoffset: 130 }}
      />
    </svg>
  );
}

/** Four-point hand-drawn sparkle. */
export function Sparkle({ className, color = "#8B5CF6", delay = "0s" }: { className?: string; color?: string; delay?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={`h26-twinkle ${className ?? ""}`} style={{ animationDelay: delay }}>
      <path
        d="M12 2 C 12.7 7.5, 13.5 9.3, 22 12 C 13.5 14.7, 12.7 16.5, 12 22 C 11.3 16.5, 10.5 14.7, 2 12 C 10.5 9.3, 11.3 7.5, 12 2 Z"
        fill={color}
      />
    </svg>
  );
}

/** A scribbled hand-drawn circle, for ringing a word. */
export function Scribble({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 64" fill="none" aria-hidden className={className}>
      <path
        d="M22 34 C 16 14, 60 6, 92 8 C 130 10, 152 18, 150 32 C 148 48, 112 58, 72 56 C 38 55, 12 48, 16 32 C 19 20, 44 12, 78 12"
        stroke="#7C3AED"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
        className="h26-draw"
        style={{ strokeDasharray: 420, strokeDashoffset: 420, animationDelay: "0.4s" }}
      />
    </svg>
  );
}

/** CURLY drawn arrow — loops once on its way down. */
export function CurlyArrow({ className, color = "#E0418D" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 90 110" fill="none" aria-hidden className={className}>
      <path
        d="M78 8 C 40 14, 30 34, 44 44 C 58 54, 70 42, 58 32 C 44 21, 20 38, 26 62 C 30 79, 38 88, 42 96"
        stroke={color}
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
        className="h26-draw"
        style={{ strokeDasharray: 260, strokeDashoffset: 260 }}
      />
      <path
        d="M28 88 L43 99 L54 84"
        stroke={color}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** Small curly swirl arrow pointing down, for inline nudges. */
export function SwirlArrow({ className, color = "#7C3AED" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 80 70" fill="none" aria-hidden className={className}>
      <path
        d="M6 12 C 30 2, 52 8, 52 22 C 52 34, 36 36, 34 26 C 32 16, 48 12, 58 22 C 68 32, 68 44, 62 56"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        className="h26-draw"
        style={{ strokeDasharray: 200, strokeDashoffset: 200 }}
      />
      <path d="M50 48 L61 59 L72 47" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Wavy section divider. */
export function Wave({ flip = false, tint = "#FDF3F9" }: { flip?: boolean; tint?: string }) {
  return (
    <svg viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden className={`block w-full h-[42px] ${flip ? "rotate-180" : ""}`}>
      <path d="M0 30 C 150 60, 300 0, 480 25 C 660 50, 800 5, 980 28 C 1090 42, 1150 30, 1200 22 L1200 60 L0 60 Z" fill={tint} />
    </svg>
  );
}

/* ---------------------------------------------------------------- content */

type Challenge = {
  short: string;
  org: string | null;
  emoji: string;
  challenge?: string;
  /** A revealed partner whose challenge lands later — logo card, no details. */
  teaser?: string;
  samples?: boolean;
  /** Round badge logo (replaces the emoji blob in the card header). */
  badgeLogo?: string;
  /** Wide partner logo shown inside/under the card. */
  partnerLogo?: string;
  tilt: string;
  tint: string;
};

const CHALLENGES: Challenge[] = [
  {
    short: "המעבדה המרכזית לנגיפים",
    org: "משרד הבריאות · המרכז הרפואי שיבא",
    emoji: "🧬",
    challenge:
      "חילוץ מידע על המטופל מתוך טפסי 17 שמגיעים בפורמטים שונים ומשונים — סרוקים, מצולמים, מודפסים וכתובים ביד. המנוע שלך צריך לקבל טופס ולהחזיר את פרטי המטופל בצורה מובנית ואמינה.",
    samples: true,
    badgeLogo: "/hackathon-2026/logo-virology.png",
    partnerLogo: "/hackathon-2026/logo-moh.jpg",
    tilt: "md:-rotate-2",
    tint: "bg-white",
  },
  { short: "שת\"פ יוכרז בקרוב", org: null, emoji: "🤫", tilt: "md:rotate-2", tint: "bg-tint-purple/40" },
  { short: "שת\"פ יוכרז בקרוב", org: null, emoji: "🎁", tilt: "md:rotate-1", tint: "bg-tint-warm/50" },
  { short: "שת\"פ יוכרז בקרוב", org: null, emoji: "🚀", tilt: "md:-rotate-1", tint: "bg-tint-mint/40" },
];

const TICKER = "🚀 האקתון AI קוד פתוח 2026 ✦ בונות פתרון אמיתי ✦ מנטוריות מלוות ✦ שת\"פים מהתעשייה ✦ ";

/* ---------------------------------------------------------------- pieces */

/** Page-scoped playfulness — stilled entirely under reduced motion. */
export function H26Style() {
  return (
    <style>{`
      @keyframes h26-float { 0%,100%{ translate: 0 0 } 50%{ translate: 0 -9px } }
      @keyframes h26-twinkle { 0%,100%{ opacity:.95 } 50%{ opacity:.3 } }
      @keyframes h26-blob {
        0%,100%{ border-radius:63% 37% 54% 46%/55% 48% 52% 45% }
        50%{ border-radius:40% 60% 45% 55%/52% 40% 60% 48% }
      }
      @keyframes h26-wobble { 0%,100%{ rotate:5deg; scale:1 } 50%{ rotate:-4deg; scale:1.05 } }
      @keyframes h26-wiggle { 0%,100%{ rotate:-7deg } 50%{ rotate:9deg } }
      @keyframes h26-draw-kf { to { stroke-dashoffset: 0 } }
      @keyframes h26-spin { from{ rotate:0deg } to{ rotate:360deg } }
      @keyframes h26-marquee { from{ transform:translateX(-50%) } to{ transform:translateX(0) } }
      @keyframes h26-bounce { 0%,100%{ translate:0 0 } 50%{ translate:0 -5px } }
      .h26-twinkle { animation: h26-twinkle 2.6s ease-in-out infinite; }
      .h26-float { animation: h26-float 4.5s ease-in-out infinite; }
      .h26-blob { animation: h26-blob 9s ease-in-out infinite; }
      .h26-wobble { animation: h26-wobble 5s ease-in-out infinite; }
      .h26-wiggle { animation: h26-wiggle 2.8s ease-in-out infinite; display:inline-block; }
      .h26-draw { animation: h26-draw-kf 1.6s ease-out 0.3s forwards; }
      .h26-spin-slow { animation: h26-spin 50s linear infinite; }
      .h26-spin-rev { animation: h26-spin 80s linear infinite reverse; }
      .h26-bounce { animation: h26-bounce 2.2s ease-in-out infinite; }
      .h26-ticker-track { animation: h26-marquee 22s linear infinite; }
      @media (prefers-reduced-motion: reduce) {
        .h26-twinkle,.h26-float,.h26-blob,.h26-wobble,.h26-wiggle,.h26-spin-slow,.h26-spin-rev,.h26-bounce,.h26-draw,.h26-ticker-track{ animation:none !important; }
        .h26-draw{ stroke-dashoffset:0 !important; }
      }
    `}</style>
  );
}

/** The hero — identical on both pages. */
export function HeroSection() {
  return (
    <section className="relative px-6 pt-14 pb-16 text-center">
      <div className="bg-brand-glow absolute inset-0 -z-10" />
      <div aria-hidden className="h26-blob absolute -top-16 -left-20 w-72 h-72 bg-tint-pink/60 -z-10" />
      <div aria-hidden className="h26-blob absolute top-40 -right-24 w-80 h-80 bg-tint-purple/50 -z-10" style={{ animationDelay: "2s" }} />
      <Sparkle className="absolute top-12 right-[12%] w-6 h-6" />
      <Sparkle className="absolute top-48 left-[8%] w-4 h-4" color="#E0418D" delay="0.8s" />
      <Sparkle className="absolute bottom-16 right-[22%] w-5 h-5" color="#F0B429" delay="1.5s" />
      <Sparkle className="absolute bottom-32 left-[18%] w-3.5 h-3.5" delay="2.1s" />
      <span aria-hidden className="h26-float absolute top-10 right-[6%] font-mono text-[16px] text-brand-pink-deep/60 rotate-6 select-none hidden sm:block">
        {"while (challenge) { build(); }"}
      </span>
      <span aria-hidden className="h26-float absolute top-36 left-[5%] font-mono text-[16px] text-brand-purple/60 -rotate-12 select-none hidden sm:block" style={{ animationDelay: "1.2s" }}>
        {"agent.solve(realProblem)"}
      </span>
      <span aria-hidden className="h26-float absolute top-64 right-[4%] font-mono text-[15.5px] text-brand-purple/50 -rotate-6 select-none hidden md:block" style={{ animationDelay: "0.6s" }}>
        {"ai.teachMe(\"how-it-works\")"}
      </span>
      <span aria-hidden className="h26-float absolute bottom-24 left-[7%] font-mono text-[15.5px] text-brand-pink-deep/50 rotate-12 select-none hidden md:block" style={{ animationDelay: "1.8s" }}>
        {"if (stuck) askMentor() 💜"}
      </span>
      <span aria-hidden className="h26-float absolute bottom-10 right-[14%] font-mono text-[15.5px] text-[#B48A0A]/60 -rotate-3 select-none hidden lg:block" style={{ animationDelay: "2.4s" }}>
        {"deploy(\"cloud\") // ✨"}
      </span>
      <span aria-hidden className="h26-float absolute top-24 left-[16%] font-mono text-[15px] text-brand-purple/40 rotate-3 select-none hidden lg:block" style={{ animationDelay: "3s" }}>
        {"const win = you.build()"}
      </span>

      <div className="max-w-2xl mx-auto flex flex-col items-center gap-5">
        <Link href="/">
          <Logo width={210} />
        </Link>
        <span className="font-mono text-xs text-brand-pink-deep rotate-1">&lt;hackathon/&gt;</span>
        <h1 className="font-display text-[42px] sm:text-[56px] font-black leading-[1.02]">
          האקתון{" "}
          <span className="relative inline-block">
            <span className="t-gradient">AI</span>
            <Squiggle className="absolute -bottom-2 right-0 w-full" />
          </span>{" "}
          קוד פתוח
          <span className="relative block w-fit mx-auto mt-3 text-[30px] sm:text-[36px] text-ink-700 font-black rotate-2">
            <Scribble className="absolute -inset-x-8 -inset-y-3 w-[calc(100%+64px)] h-[calc(100%+24px)]" />
            2026
          </span>
        </h1>
        <p className="t-body-lg text-ink-700 max-w-lg">
          אתגרי AI אמיתיים מהתעשייה.
          <span className="block mt-1">בהאקתון הזה את בוחרת את האתגר שהכי מלהיב אותך</span>
          <span className="block font-bold text-ink-900">ומתמודדת על המקום הראשון! 🏆</span>
        </p>
        <div className="flex items-center gap-2.5 flex-wrap justify-center">
          <span className="h26-bounce -rotate-2 bg-ink-1000 text-white px-3.5 py-1.5 rounded-full text-[16px] font-bold shadow-md">
            📅 אחרי החגים
          </span>
          <span className="h26-bounce rotate-1 bg-brand-gradient text-white px-3.5 py-1.5 rounded-full text-[16px] font-bold shadow-md" style={{ animationDelay: "0.4s" }}>
            💜 למנויות הקהילה בלבד
          </span>
          <span className="h26-bounce -rotate-1 bg-white border-[1.5px] border-brand-purple text-brand-purple px-3.5 py-1.5 rounded-full text-[16px] font-bold shadow-md" style={{ animationDelay: "0.8s" }}>
            🏆 שת״פים מהתעשייה
          </span>
        </div>
        {/* curly arrow inviting the scroll down to the challenges */}
        <div className="flex items-start gap-1 mt-1">
          <span className="font-display font-bold text-[17.5px] text-brand-pink-deep rotate-6 mt-1">האתגרים כאן למטה</span>
          <CurlyArrow className="h26-float w-14 h-16" />
        </div>
      </div>
    </section>
  );
}

/** Code ticker strip — two identical halves, the track slides exactly one
    half per cycle, so the loop is seamless and truly endless. */
export function TickerStrip() {
  return (
    <div className="bg-brand-gradient py-2 overflow-hidden" dir="ltr" aria-hidden>
      <div className="h26-ticker-track flex whitespace-nowrap w-max" style={{ direction: "rtl" }}>
        <span className="font-display font-bold text-white text-[15.5px] tracking-wide">{TICKER.repeat(6)}</span>
        <span className="font-display font-bold text-white text-[15.5px] tracking-wide">{TICKER.repeat(6)}</span>
      </div>
    </div>
  );
}

/** The four challenges, orbiting the core — identical on both pages. */
export function ChallengesSection() {
  return (
    <section className="px-6 pt-10 pb-20 bg-[#FBF7FF] relative">
      <Sparkle className="absolute top-16 left-[10%] w-5 h-5" color="#E0418D" delay="0.6s" />
      <Sparkle className="absolute bottom-24 right-[8%] w-6 h-6" delay="1.4s" />
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <span className="font-mono text-xs text-brand-pink-deep">&lt;אתגרים/&gt;</span>
          <h2 className="font-display text-[30px] font-black mt-1 -rotate-1">
            ארבעה שת״פים. ארבעה אתגרים.
          </h2>
          <p className="t-body text-ink-700 mt-1">
            כל ארגון מביא בעיה אמיתית מהשטח — לחצי על אתגר כדי לקרוא אותו <span className="h26-wiggle">👇</span>
          </p>
        </div>

        <div className="relative">
          <div aria-hidden className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none">
            <div className="h26-spin-slow absolute w-[380px] h-[380px] rounded-full border-2 border-dashed border-brand-pink/40" />
            <div className="h26-spin-slow absolute w-[380px] h-[380px]">
              <span className="absolute -top-1.5 left-1/2 w-3 h-3 rounded-full bg-brand-pink-deep" />
              <span className="absolute top-1/2 -right-1.5 w-2.5 h-2.5 rounded-full bg-brand-purple" />
              <span className="absolute -bottom-1 left-1/4 w-2 h-2 rounded-full bg-[#F0B429]" />
            </div>
            <div className="h26-spin-rev absolute w-[460px] h-[460px] rounded-full border border-dashed border-brand-purple/25" />
            <div
              className="h26-wobble w-28 h-28 bg-brand-gradient text-white flex flex-col items-center justify-center shadow-glow-pink font-display font-black"
              style={{ borderRadius: "58% 42% 45% 55% / 48% 55% 45% 52%" }}
            >
              <span className="text-[22px] leading-none">AI</span>
              <span className="text-[16px] mt-0.5">2026</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-x-44 md:gap-y-20">
            {CHALLENGES.map((c, i) => (
              <div key={i} className={`${c.tilt} transition-transform hover:rotate-0 hover:scale-[1.02]`}>
                {c.challenge ? (
                  <details
                    className={`group ${c.tint} border-2 border-ink-900/10 shadow-[4px_5px_0_0_#F3C6DD] open:shadow-[6px_7px_0_0_#E0418D] open:border-brand-pink transition-all`}
                    style={{ borderRadius: "22px 26px 20px 28px" }}
                  >
                    <summary className="list-none cursor-pointer p-5 flex items-center gap-3.5 [&::-webkit-details-marker]:hidden">
                      {c.badgeLogo ? (
                        <span className="w-14 h-14 shrink-0 -rotate-6 rounded-full overflow-hidden bg-white border-2 border-brand-pink/30 shadow-[3px_3px_0_0_#F3C6DD] flex items-center justify-center p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.badgeLogo} alt={c.short} className="w-full h-full object-contain" />
                        </span>
                      ) : (
                        <span
                          className="w-12 h-12 bg-brand-gradient text-white text-[22px] flex items-center justify-center shrink-0 -rotate-6"
                          style={{ borderRadius: "45% 55% 52% 48% / 50% 46% 54% 50%" }}
                        >
                          <span className="h26-wiggle">{c.emoji}</span>
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block font-display font-black text-[20px] leading-tight">{c.short}</span>
                        {c.org && <span className="block text-[15.5px] text-ink-500 mt-0.5">{c.org}</span>}
                      </span>
                      <span className="font-mono text-brand-pink-deep text-sm group-open:rotate-90 transition-transform">&gt;</span>
                    </summary>
                    <div className="px-5 pb-5 pt-0 flex flex-col gap-3">
                      <div className="font-mono text-[14.5px] text-brand-pink-deep">{"// האתגר"}</div>
                      <p className="t-body text-ink-900 leading-relaxed">{c.challenge}</p>
                      {c.partnerLogo && (
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-[16px] text-ink-400">בשיתוף:</span>
                          <span className="bg-white border border-ink-100 rounded-[16px] px-5 py-3 rotate-[-1deg] shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c.partnerLogo} alt={c.org ?? ""} className="h-20 w-auto max-w-full" />
                          </span>
                        </div>
                      )}
                      {c.samples && (
                        <span
                          className="inline-flex w-fit items-center gap-1.5 text-[15.5px] font-semibold text-ink-500 bg-ink-50 border border-dashed border-ink-300 px-3 py-1.5 rotate-1"
                          style={{ borderRadius: "12px 16px 12px 18px" }}
                        >
                          📄 טפסי דוגמה להורדה — יעלו כאן עם פתיחת ההרשמה
                        </span>
                      )}
                    </div>
                  </details>
                ) : c.teaser ? (
                  <div
                    className={`${c.tint} border-2 border-ink-900/10 shadow-[4px_5px_0_0_#CFE6D8] p-5 flex items-center gap-4`}
                    style={{ borderRadius: "22px 28px 20px 26px" }}
                  >
                    <span className="w-16 h-16 shrink-0 rotate-3 rounded-full overflow-hidden bg-white border-2 border-ink-100 shadow-sm flex items-center justify-center p-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.badgeLogo} alt={c.short} className="w-full h-full object-contain" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-display font-black text-[21px] leading-tight">{c.short}</span>
                      {c.org && <span className="block text-[15.5px] text-ink-500 mt-0.5">{c.org}</span>}
                      <span className="mt-1.5 inline-flex items-center gap-1.5 text-[16.5px] font-semibold text-brand-pink-deep bg-tint-pink px-2.5 py-1 rounded-full rotate-[-1deg]">
                        {c.teaser}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div
                    className={`${c.tint} border-2 border-dashed border-ink-300/70 p-5 flex items-center gap-3.5`}
                    style={{ borderRadius: "26px 20px 28px 22px" }}
                  >
                    <span
                      className="w-12 h-12 bg-white border border-ink-200 text-[22px] flex items-center justify-center shrink-0 rotate-6"
                      style={{ borderRadius: "50% 46% 54% 50% / 45% 55% 52% 48%" }}
                    >
                      <span className="h26-wiggle" style={{ animationDelay: `${i * 0.5}s` }}>{c.emoji}</span>
                    </span>
                    <span className="flex-1">
                      <span className="block font-display font-black text-[20px] text-ink-500">{c.short}</span>
                      <span className="block text-[15.5px] text-ink-400 mt-0.5">האתגר בדרך…</span>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Shared page footer. */
export function HackathonFooter() {
  return (
    <footer className="px-6 py-8 text-center text-ink-500 text-sm border-t border-ink-200 bg-white">
      קוד פתוח · השמה. הכשרה. תרבות 💜 ·{" "}
      <span className="font-mono text-[15px] text-brand-pink-deep">האקתון AI 2026</span>
    </footer>
  );
}
