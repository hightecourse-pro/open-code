// האקתון AI קוד פתוח 2026 — the standalone event page (the owner, 1/9).
// UNLINKED on purpose: reachable by direct URL only, until the owner decides
// to link it from the community hackathon page (and possibly open it up
// externally). Design round 3 (the owner: "יותר שובב, חיצים מאוירים
// מסולסלים, אנימציות") — curly drawn arrows, floating sparkles, breathing
// blobs, a wobbling core, a code ticker; prefers-reduced-motion stills it all.
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata: Metadata = {
  title: "האקתון AI קוד פתוח 2026",
  description: "אתגרי AI אמיתיים מהתעשייה — בונות פתרון, אנחנו מלוות. למנויות הקהילה.",
};

/* ---------------------------------------------------------------- doodles */

/** Hand-drawn squiggle underline. */
function Squiggle({ className }: { className?: string }) {
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
function Sparkle({ className, color = "#8B5CF6", delay = "0s" }: { className?: string; color?: string; delay?: string }) {
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
function Scribble({ className }: { className?: string }) {
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
function CurlyArrow({ className, color = "#E0418D" }: { className?: string; color?: string }) {
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
function SwirlArrow({ className, color = "#7C3AED" }: { className?: string; color?: string }) {
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
function Wave({ flip = false, tint = "#FDF3F9" }: { flip?: boolean; tint?: string }) {
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
  samples?: boolean;
  tilt: string;
  tint: string;
};

const CHALLENGES: Challenge[] = [
  {
    short: "המעבדה המרכזית לנגיפים",
    org: "משרד הבריאות · שיבא",
    emoji: "🧬",
    challenge:
      "חילוץ מידע על המטופל מתוך טפסי 17 שמגיעים בפורמטים שונים ומשונים — סרוקים, מצולמים, מודפסים וכתובים ביד. המנוע שלך צריך לקבל טופס ולהחזיר את פרטי המטופל בצורה מובנית ואמינה.",
    samples: true,
    tilt: "md:-rotate-2",
    tint: "bg-white",
  },
  { short: "שת\"פ יוכרז בקרוב", org: null, emoji: "🤫", tilt: "md:rotate-2", tint: "bg-tint-purple/40" },
  { short: "שת\"פ יוכרז בקרוב", org: null, emoji: "🎁", tilt: "md:rotate-1", tint: "bg-tint-warm/50" },
  { short: "שת\"פ יוכרז בקרוב", org: null, emoji: "🚀", tilt: "md:-rotate-1", tint: "bg-tint-mint/40" },
];

const STEPS = [
  { emoji: "🎯", title: "בוחרת אתגר", body: "עוברת על ארבעת האתגרים ובוחרת את זה שמדליק אותך.", tilt: "-rotate-2" },
  { emoji: "📝", title: "ממלאה טופס בחירה", body: "רישום קצר — הטופס ייפתח בקהילה ברגע שההרשמה תעלה.", tilt: "rotate-1" },
  { emoji: "📦", title: "מקבלת את החומרים", body: "לאתגר שבחרת יישלחו אלייך תכנים ודוגמאות רלוונטיות.", tilt: "-rotate-1" },
  { emoji: "🛠️", title: "מפתחת ויוצרת", body: "בונה את המנוע ואת הממשק — עם כלי ה-AI והמנטוריות שלצידך.", tilt: "rotate-2" },
  { emoji: "🏆", title: "מתמודדת על הזכייה", body: "מגישה את הפתרון שעבדת עליו ונלחמת על המקום הראשון בארוע.", tilt: "-rotate-1" },
];

// How you approach an AI challenge — a zigzag doodle path, לשון נוכחת
// (the owner, 31/8: redesign + "גם אם לא למדת קורס AI מלא").
const APPROACH = [
  {
    emoji: "🗺️",
    title: "מתייעצת עם ה-AI",
    body: "זורקת לו את האתגר ומפרקת את הבעיה יחד איתו לצעדים קטנים — עוד לפני שורת קוד אחת.",
    side: "self-start",
    tilt: "-rotate-1",
  },
  {
    emoji: "🎓",
    title: "לא יודעת מאיפה להתחיל?",
    body: "הסשנים של הקהילה הם בדיוק נקודת הפתיחה — סדר בעולמות ה-AI, פיתוח איג'נטים ועוד.",
    side: "self-end",
    tilt: "rotate-1",
  },
  {
    emoji: "🧑‍🏫",
    title: "בחרת שיטה? תני ל-AI ללמד אותך",
    body: "ברגע שבחרת שיטה — בקשי מה-AI שילמד אותך איך בדיוק היא עובדת, צעד אחרי צעד. ככה יהיה לך הרבה יותר קל לפתור בעיות שתיתקלי בהן בדרך.",
    side: "self-start",
    tilt: "rotate-1",
    highlight: true,
  },
  {
    emoji: "🤖",
    title: "בונה איג'נט",
    body: "מנוע AI שמקבל קלט, חושב, ומחזיר פתרון — ומנטוריות מהקהילה ילוו אותך לאורך כל הדרך 💜",
    side: "self-end",
    tilt: "-rotate-1",
  },
];

const TICKER = "🚀 האקתון AI קוד פתוח 2026 ✦ בונות פתרון אמיתי ✦ מנטוריות מלוות ✦ שת\"פים מהתעשייה ✦ ";

export default function Hackathon2026Page() {
  return (
    <main className="min-h-full bg-white text-ink-1000 overflow-x-hidden">
      {/* page-scoped playfulness — stilled entirely under reduced motion */}
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

      {/* ───────────────────────────── hero ───────────────────────────── */}
      <section className="relative px-6 pt-14 pb-16 text-center">
        <div className="bg-brand-glow absolute inset-0 -z-10" />
        <div aria-hidden className="h26-blob absolute -top-16 -left-20 w-72 h-72 bg-tint-pink/60 -z-10" />
        <div aria-hidden className="h26-blob absolute top-40 -right-24 w-80 h-80 bg-tint-purple/50 -z-10" style={{ animationDelay: "2s" }} />
        <Sparkle className="absolute top-12 right-[12%] w-6 h-6" />
        <Sparkle className="absolute top-48 left-[8%] w-4 h-4" color="#E0418D" delay="0.8s" />
        <Sparkle className="absolute bottom-16 right-[22%] w-5 h-5" color="#F0B429" delay="1.5s" />
        <Sparkle className="absolute bottom-32 left-[18%] w-3.5 h-3.5" delay="2.1s" />
        <span aria-hidden className="h26-float absolute top-10 right-[6%] font-mono text-[13px] text-brand-pink-deep/60 rotate-6 select-none hidden sm:block">
          {"while (challenge) { build(); }"}
        </span>
        <span aria-hidden className="h26-float absolute top-36 left-[5%] font-mono text-[13px] text-brand-purple/60 -rotate-12 select-none hidden sm:block" style={{ animationDelay: "1.2s" }}>
          {"agent.solve(realProblem)"}
        </span>
        <span aria-hidden className="h26-float absolute top-64 right-[4%] font-mono text-[12.5px] text-brand-purple/50 -rotate-6 select-none hidden md:block" style={{ animationDelay: "0.6s" }}>
          {"ai.teachMe(\"how-it-works\")"}
        </span>
        <span aria-hidden className="h26-float absolute bottom-24 left-[7%] font-mono text-[12.5px] text-brand-pink-deep/50 rotate-12 select-none hidden md:block" style={{ animationDelay: "1.8s" }}>
          {"if (stuck) askMentor() 💜"}
        </span>
        <span aria-hidden className="h26-float absolute bottom-10 right-[14%] font-mono text-[12.5px] text-[#B48A0A]/60 -rotate-3 select-none hidden lg:block" style={{ animationDelay: "2.4s" }}>
          {"deploy(\"cloud\") // ✨"}
        </span>
        <span aria-hidden className="h26-float absolute top-24 left-[16%] font-mono text-[12px] text-brand-purple/40 rotate-3 select-none hidden lg:block" style={{ animationDelay: "3s" }}>
          {"const win = you.build()"}
        </span>

        <div className="max-w-2xl mx-auto flex flex-col items-center gap-5">
          <Link href="/" className="-rotate-2 hover:rotate-0 transition-transform">
            <Logo width={150} />
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
            <span className="h26-bounce -rotate-2 bg-ink-1000 text-white px-3.5 py-1.5 rounded-full text-[13px] font-bold shadow-md">
              📅 אחרי החגים
            </span>
            <span className="h26-bounce rotate-1 bg-brand-gradient text-white px-3.5 py-1.5 rounded-full text-[13px] font-bold shadow-md" style={{ animationDelay: "0.4s" }}>
              💜 למנויות הקהילה בלבד
            </span>
            <span className="h26-bounce -rotate-1 bg-white border-[1.5px] border-brand-purple text-brand-purple px-3.5 py-1.5 rounded-full text-[13px] font-bold shadow-md" style={{ animationDelay: "0.8s" }}>
              🏆 שת"פים מהתעשייה
            </span>
          </div>
          {/* curly arrow inviting the scroll down to the challenges */}
          <div className="flex items-start gap-1 mt-1">
            <span className="font-display font-bold text-[14.5px] text-brand-pink-deep rotate-6 mt-1">האתגרים כאן למטה</span>
            <CurlyArrow className="h26-float w-14 h-16" />
          </div>
        </div>
      </section>

      {/* code ticker strip — two identical halves, the track slides exactly one
          half per cycle, so the loop is seamless and truly endless */}
      <div className="bg-brand-gradient py-2 overflow-hidden" dir="ltr" aria-hidden>
        <div className="h26-ticker-track flex whitespace-nowrap w-max" style={{ direction: "rtl" }}>
          <span className="font-display font-bold text-white text-[14px] tracking-wide">{TICKER.repeat(6)}</span>
          <span className="font-display font-bold text-white text-[14px] tracking-wide">{TICKER.repeat(6)}</span>
        </div>
      </div>

      {/* ─────────────── the four challenges, orbiting the core ─────────────── */}
      <section className="px-6 pt-10 pb-20 bg-[#FBF7FF] relative">
        <Sparkle className="absolute top-16 left-[10%] w-5 h-5" color="#E0418D" delay="0.6s" />
        <Sparkle className="absolute bottom-24 right-[8%] w-6 h-6" delay="1.4s" />
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;אתגרים/&gt;</span>
            <h2 className="font-display text-[30px] font-black mt-1 -rotate-1">
              ארבעה שת"פים. ארבעה אתגרים.
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
                <span className="text-[13px] mt-0.5">2026</span>
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
                        <span
                          className="w-12 h-12 bg-brand-gradient text-white text-[22px] flex items-center justify-center shrink-0 -rotate-6"
                          style={{ borderRadius: "45% 55% 52% 48% / 50% 46% 54% 50%" }}
                        >
                          <span className="h26-wiggle">{c.emoji}</span>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-display font-black text-[16.5px] leading-tight">{c.short}</span>
                          {c.org && <span className="block text-[12.5px] text-ink-500 mt-0.5">{c.org}</span>}
                        </span>
                        <span className="font-mono text-brand-pink-deep text-sm group-open:rotate-90 transition-transform">&gt;</span>
                      </summary>
                      <div className="px-5 pb-5 pt-0 flex flex-col gap-3">
                        <div className="font-mono text-[11.5px] text-brand-pink-deep">// האתגר</div>
                        <p className="t-body-sm text-ink-900 leading-relaxed">{c.challenge}</p>
                        {c.samples && (
                          <span
                            className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 bg-ink-50 border border-dashed border-ink-300 px-3 py-1.5 rotate-1"
                            style={{ borderRadius: "12px 16px 12px 18px" }}
                          >
                            📄 טפסי דוגמה להורדה — יעלו כאן עם פתיחת ההרשמה
                          </span>
                        )}
                      </div>
                    </details>
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
                        <span className="block font-display font-black text-[16.5px] text-ink-500">{c.short}</span>
                        <span className="block text-[12.5px] text-ink-400 mt-0.5">האתגר בדרך…</span>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Wave flip tint="#FBF7FF" />

      {/* ─────────────────── how to approach an AI challenge ─────────────────── */}
      <section className="px-6 py-16 relative">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-4">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;איך ניגשים/&gt;</span>
            <h2 className="font-display text-[30px] font-black mt-1 rotate-1">ככה את ניגשת לאתגר AI</h2>
            <p className="t-body text-ink-700 mt-1.5">
              גם אם לא למדת קורס AI מלא <span className="h26-wiggle">😉</span> — ה-AI הוא גם הכלי וגם המורה שלך.
            </p>
          </div>
          <div className="flex justify-end pe-6 -mb-2 items-start">
            <span className="font-display font-bold text-[14px] text-brand-purple -rotate-6 me-1 mt-2">מתחילה כאן</span>
            <SwirlArrow className="h26-float w-14 h-12" />
          </div>

          {/* zigzag doodle path — each stop leans the other way, swirl arrows in between */}
          <div className="flex flex-col">
            {APPROACH.map((a, i) => (
              <div key={a.title} className="flex flex-col">
                <div
                  className={`${a.side} ${a.tilt} hover:rotate-0 transition-transform w-full sm:w-[78%] border-2 p-5 flex gap-4 items-start ${
                    a.highlight
                      ? "bg-white border-brand-pink shadow-[6px_7px_0_0_#E0418D] relative"
                      : "bg-white border-ink-900/10 shadow-[5px_6px_0_0_#EDE4F7]"
                  }`}
                  style={{ borderRadius: i % 2 ? "24px 20px 28px 22px" : "20px 28px 22px 26px" }}
                >
                  {a.highlight && <Sparkle className="absolute -top-3 -left-3 w-7 h-7" color="#E0418D" />}
                  <span
                    className={`w-12 h-12 text-[24px] flex items-center justify-center shrink-0 ${a.highlight ? "bg-brand-gradient" : "bg-tint-purple/60"} ${i % 2 ? "rotate-6" : "-rotate-6"}`}
                    style={{ borderRadius: "48% 52% 55% 45% / 52% 45% 55% 48%" }}
                  >
                    <span className="h26-wiggle" style={{ animationDelay: `${i * 0.5}s` }}>{a.emoji}</span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-display font-black text-[16.5px] leading-snug">{a.title}</span>
                    <span className="block t-body-sm text-ink-700 mt-1">{a.body}</span>
                  </span>
                </div>
                {i < APPROACH.length - 1 && (
                  <div className={`flex ${i % 2 ? "justify-start ps-[22%]" : "justify-end pe-[22%]"} -my-1.5`}>
                    <SwirlArrow
                      className={`h26-float w-12 h-10 ${i % 2 ? "-scale-x-100" : ""}`}
                      color={i % 2 ? "#E0418D" : "#7C3AED"}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* the code-flavored tip stays — one playful mono line */}
          <p
            className="font-mono text-[12.5px] text-ink-500 bg-ink-50 border border-dashed border-ink-300 px-4 py-2.5 mt-8 w-fit mx-auto rotate-1"
            style={{ borderRadius: "14px 18px 14px 20px" }}
          >
            {"// טיפ: רישיון לכלי AI רציני כמו Claude Code שווה את זה — הוא בונה איתך את הפרויקט 🚀"}
          </p>

          {/* מה בונים? — the two halves of the project, joined by a drawn plus
              (the owner, 31/8: add the question with a curly arrow + redesign) */}
          <div className="mt-16 relative">
            <Sparkle className="absolute -top-2 left-[12%] w-5 h-5" color="#E0418D" delay="0.7s" />
            <div className="flex items-end justify-center gap-1 mb-2">
              <span className="font-display font-black text-[26px] text-ink-1000 -rotate-3">
                מה בונים?
                <Squiggle className="block w-28 mx-auto -mt-1" />
              </span>
              <SwirlArrow className="h26-float w-14 h-12 mb-1" color="#E0418D" />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch justify-center gap-4 sm:gap-3 mt-6">
              <div
                className="flex-1 max-w-xs mx-auto sm:mx-0 bg-tint-purple/50 border-2 border-brand-purple/40 p-5 text-center -rotate-2 hover:rotate-0 transition-transform shadow-[6px_7px_0_0_#DDC9EC]"
                style={{ borderRadius: "30px 22px 34px 24px" }}
              >
                <span
                  className="w-14 h-14 mx-auto bg-white border-2 border-brand-purple/30 text-[28px] flex items-center justify-center -rotate-6"
                  style={{ borderRadius: "52% 48% 45% 55% / 48% 55% 45% 52%" }}
                >
                  <span className="h26-wiggle">🧠</span>
                </span>
                <h3 className="font-display font-black text-[17px] mt-2">מנוע AI</h3>
                <p className="t-body-sm text-ink-700 mt-1">הלב של הפרויקט — מקבל את הבעיה של הארגון ומחזיר פתרון אמיתי.</p>
              </div>

              <div className="flex items-center justify-center shrink-0">
                <span
                  className="h26-wobble w-12 h-12 bg-brand-gradient text-white font-display font-black text-[26px] flex items-center justify-center shadow-glow-pink"
                  style={{ borderRadius: "55% 45% 48% 52% / 45% 52% 48% 55%" }}
                >
                  +
                </span>
              </div>

              <div
                className="flex-1 max-w-xs mx-auto sm:mx-0 bg-tint-pink/40 border-2 border-brand-pink/40 p-5 text-center rotate-2 hover:rotate-0 transition-transform shadow-[6px_7px_0_0_#F3C6DD]"
                style={{ borderRadius: "22px 32px 24px 30px" }}
              >
                <span
                  className="w-14 h-14 mx-auto bg-white border-2 border-brand-pink/30 text-[28px] flex items-center justify-center rotate-6"
                  style={{ borderRadius: "45% 55% 52% 48% / 55% 45% 52% 48%" }}
                >
                  <span className="h26-float inline-block">☁️</span>
                </span>
                <h3 className="font-display font-black text-[17px] mt-2">ממשק בענן</h3>
                <p className="t-body-sm text-ink-700 mt-1">UI שאפשר לגשת אליו מכל מקום ולראות את הפתרון עובד — ככה השופטות והארגון פוגשים אותו.</p>
              </div>
            </div>

            <p className="text-center font-display font-bold text-[15px] text-brand-purple mt-5 rotate-1">
              = פרויקט AI אמיתי שעובד מכל מקום <Sparkle className="inline-block w-4 h-4 align-[-2px]" color="#F0B429" />
            </p>
          </div>
        </div>
      </section>

      <Wave tint="#FDF3F9" />

      {/* ─────────────────────────── the steps ─────────────────────────── */}
      <section className="px-6 pt-6 pb-16 bg-[#FDF3F9] relative">
        <Sparkle className="absolute top-10 right-[12%] w-5 h-5" delay="0.9s" />
        <Sparkle className="absolute bottom-16 left-[10%] w-4 h-4" color="#E0418D" delay="1.7s" />
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;נרשמות/&gt;</span>
            <h2 className="font-display text-[30px] font-black mt-1 -rotate-1">5 צעדים — ויש לך פרויקט AI משמעותי משלך</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className={`bg-white border-2 border-ink-900/10 p-5 text-center ${s.tilt} hover:rotate-0 transition-transform shadow-[4px_5px_0_0_#EDE4F7]`}
                style={{ borderRadius: i % 2 ? "20px 26px 22px 28px" : "26px 20px 28px 22px" }}
              >
                <div
                  className="w-11 h-11 mx-auto bg-brand-gradient text-white font-display font-black text-[17px] flex items-center justify-center rotate-6"
                  style={{ borderRadius: "48% 52% 55% 45% / 50% 45% 55% 50%" }}
                >
                  {i + 1}
                </div>
                <div className="text-[24px] mt-2"><span className="h26-wiggle" style={{ animationDelay: `${i * 0.6}s` }}>{s.emoji}</span></div>
                <h3 className="font-display font-black text-[15.5px] mt-1">{s.title}</h3>
                <p className="t-body-sm text-ink-700 mt-1">{s.body}</p>
              </div>
            ))}
          </div>

          {/* the glittering finale */}
          <div
            className="mt-12 mx-auto max-w-xl bg-brand-gradient text-white text-center p-6 rotate-1 shadow-[6px_7px_0_0_#DDC9EC] relative overflow-hidden"
            style={{ borderRadius: "28px 22px 30px 24px" }}
          >
            <Sparkle className="absolute top-3 right-6 w-5 h-5" color="#FFFFFF" />
            <Sparkle className="absolute bottom-4 left-8 w-4 h-4" color="#F8D98C" delay="1.1s" />
            <Sparkle className="absolute top-8 left-1/4 w-3 h-3" color="#FFFFFF" delay="0.5s" />
            <div className="text-[30px]"><span className="h26-wiggle">🎉</span></div>
            <div className="font-display font-black text-[22px] mt-1">אירוע סיום נוצץ ✨</div>
            <div className="font-display font-bold text-[15px] mt-1 opacity-95">
              באמצע חשוון — הקהילה חוגגת, והזוכות עולות לבמה 🏆
            </div>
          </div>

          <div className="text-center mt-10 flex flex-col items-center gap-3 relative">
            <CurlyArrow className="w-12 h-14 absolute -top-12 right-[26%] rotate-[24deg] hidden sm:block" color="#7C3AED" />
            <span
              className="h26-bounce inline-flex items-center gap-2 bg-white border-2 border-dashed border-brand-pink/50 px-6 py-3 font-display font-bold text-[15px] text-ink-700 -rotate-1 shadow-[4px_5px_0_0_#F3C6DD]"
              style={{ borderRadius: "999px" }}
            >
              🔒 טופס הבחירה ייפתח בקהילה ממש בקרוב
            </span>
            <p className="t-body-sm text-ink-500 max-w-md">
              ההשתתפות למנויות הקהילה בלבד — עוד לא איתנו?{" "}
              <Link href="/join" className="font-semibold text-brand-purple hover:underline">
                מצטרפות כאן
              </Link>{" "}
              💜
            </p>
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-ink-500 text-sm border-t border-ink-200 bg-white">
        קוד פתוח · השמה. הכשרה. תרבות 💜 ·{" "}
        <span className="font-mono text-[12px] text-brand-pink-deep">האקתון AI 2026</span>
      </footer>
    </main>
  );
}
