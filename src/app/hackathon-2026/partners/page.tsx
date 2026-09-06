import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata: Metadata = {
  title: "האקתון AI קוד פתוח 2026 — לשותפים",
  description: "אתגר אמיתי שלכם, עשרות מפתחות AI, ופתרונות עובדים — בואו להיות שותפים.",
};

/* Doodle helpers — same visual language as the hackathon page, turned up. */
function Sparkle({ className, color = "#7C3AED", delay = "0s" }: { className?: string; color?: string; delay?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={`hp-twinkle ${className ?? ""}`} style={{ animationDelay: delay }}>
      <path d="M12 2 L14 9.5 L21.5 12 L14 14.5 L12 22 L10 14.5 L2.5 12 L10 9.5 Z" fill={color} />
    </svg>
  );
}

function Underline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 12" fill="none" aria-hidden className={className}>
      <path
        d="M3 8 Q 13 2, 23 7 T 43 7 T 63 8 T 83 6 T 103 8 T 117 6"
        stroke="#E0418D"
        strokeWidth="3.5"
        strokeLinecap="round"
        className="hp-draw"
        style={{ strokeDasharray: 130, strokeDashoffset: 130 }}
      />
    </svg>
  );
}

const FLOW = [
  { emoji: "🧩", title: "אתם מביאים אתגר אמיתי", body: "בעיה מהשטח שלכם — מסמכים, דאטה, תהליך שמבקש אוטומציה. אנחנו עוזרות למסגר אותה כאתגר." },
  { emoji: "⚡", title: "עשרות מפתחות בונות פתרון", body: "כל אחת בוחרת את האתגר שלה, בונה מנוע AI וממשק — עם ליווי מנטוריות לאורך כל הדרך." },
  { emoji: "🏆", title: "אתם פוגשים יכולות מוכחות", body: "בערב הגמר אתם רואים פתרונות עובדים — ואת המפתחות שבנו אותם, עם הוכחת עבודה אמיתית ביד." },
];

const VALUE = [
  { emoji: "🔍", title: "גישה מוקדמת לטאלנט", body: "אתן פוגשים את המפתחות החזקות לפני כולם — לא דרך קורות חיים, דרך פתרון עובד לבעיה שלכם." },
  { emoji: "💡", title: "עשרות זוויות על בעיה אחת", body: "אותו אתגר, פתרונות שונים — מגוון גישות הנדסיות שקשה לקנות בכל דרך אחרת." },
  { emoji: "💜", title: "שותפות עם משמעות", body: "שער כניסה להייטק לנשים חרדיות מוכשרות — סיפור השפעה אמיתי שהשם שלכם חתום עליו." },
];

export default function HackathonPartnersPage() {
  return (
    <main dir="rtl" className="min-h-full bg-white text-ink-1000 overflow-x-hidden">
      <style>{`
        @keyframes hp-float { 0%,100%{ translate: 0 0 } 50%{ translate: 0 -9px } }
        @keyframes hp-twinkle { 0%,100%{ opacity:.95 } 50%{ opacity:.3 } }
        @keyframes hp-blob {
          0%,100%{ border-radius:63% 37% 54% 46%/55% 48% 52% 45% }
          50%{ border-radius:40% 60% 45% 55%/52% 40% 60% 48% }
        }
        @keyframes hp-draw-kf { to { stroke-dashoffset: 0 } }
        @keyframes hp-marquee { from{ transform:translateX(-50%) } to{ transform:translateX(0) } }
        .hp-twinkle { animation: hp-twinkle 2.6s ease-in-out infinite; }
        .hp-float { animation: hp-float 4.5s ease-in-out infinite; }
        .hp-blob { animation: hp-blob 9s ease-in-out infinite; }
        .hp-draw { animation: hp-draw-kf 1.6s ease-out 0.3s forwards; }
        .hp-ticker-track { animation: hp-marquee 22s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hp-twinkle,.hp-float,.hp-blob,.hp-draw,.hp-ticker-track{ animation:none !important; }
          .hp-draw{ stroke-dashoffset:0 !important; }
        }
      `}</style>

      {/* ── hero: the question ─────────────────────────────────────────── */}
      <section className="relative px-6 pt-14 pb-20 text-center">
        <div className="bg-brand-glow absolute inset-0 -z-10" />
        <div aria-hidden className="hp-blob absolute -top-16 -left-20 w-72 h-72 bg-tint-pink/60 -z-10" />
        <div aria-hidden className="hp-blob absolute top-40 -right-24 w-80 h-80 bg-tint-purple/50 -z-10" style={{ animationDelay: "2s" }} />
        <Sparkle className="absolute top-12 right-[12%] w-6 h-6" />
        <Sparkle className="absolute top-48 left-[8%] w-4 h-4" color="#E0418D" delay="0.8s" />
        <Sparkle className="absolute bottom-16 right-[22%] w-5 h-5" color="#F0B429" delay="1.5s" />

        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          <Link href="/hackathon-2026">
            <Logo width={190} />
          </Link>
          <span className="font-mono text-sm text-brand-pink-deep">&lt;לשותפים ולספונסרים/&gt;</span>

          <p className="font-display font-bold text-[20px] text-ink-500 -mb-3">השאלה שנמצאת בלב האתגר של ג׳וניוריות בהייטק:</p>
          <h1 className="font-display font-black text-[40px] md:text-[54px] leading-[1.12]">
            איך ג׳וניורית
            <span className="relative inline-block mx-2 text-brand-pink-deep">
              מוכיחה
              <Underline className="absolute -bottom-2 inset-x-0 w-full h-3" />
            </span>
            <span className="block mt-1">מה היא באמת יודעת?</span>
          </h1>

          <p className="t-body text-[19px] text-ink-700 max-w-xl leading-relaxed">
            אין לה שנתיים ניסיון בקורות החיים. יש לה יכולות אמיתיות.
            <span className="block mt-1 font-semibold text-ink-900">
              ההאקתון שלנו הוא המקום שבו היא מוכיחה אותן — על אתגר אמיתי. אולי שלכם.
            </span>
          </p>
        </div>
      </section>

      {/* ── the answer: a bold statement band ──────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-gradient text-white py-3" dir="ltr">
        <div className="hp-ticker-track flex whitespace-nowrap w-max" style={{ direction: "rtl" }} aria-hidden>
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="flex items-center gap-6 px-3 font-display font-bold text-[16px]">
              <span>✦ כל ג׳וניורית — מפתחת AI</span>
              <span>✦ פתרון עובד במקום שורת קו״ח</span>
              <span>✦ אתגר אמיתי מהתעשייה</span>
              <span>✦ האקתון AI קוד פתוח 2026</span>
              <span>✦ כל ג׳וניורית — מפתחת AI</span>
              <span>✦ פתרון עובד במקום שורת קו״ח</span>
              <span>✦ אתגר אמיתי מהתעשייה</span>
              <span>✦ האקתון AI קוד פתוח 2026</span>
            </span>
          ))}
        </div>
      </section>

      <section className="px-6 py-16 text-center">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
          <span className="font-mono text-sm text-brand-pink-deep">&lt;התשובה שלנו/&gt;</span>
          <h2 className="font-display font-black text-[30px] md:text-[36px] leading-tight">
            שכל ג׳וניורית בקהילה תהיה <span className="text-brand-purple">מפתחת AI רלוונטית</span> —
            <span className="block mt-1">עם פתרון עובד שמדבר בשמה.</span>
          </h2>
          <p className="t-body text-[18px] text-ink-700 max-w-xl leading-relaxed">
            מאות מפתחות מהקהילה, אתגרי AI אמיתיים מארגונים אמיתיים, וליווי צמוד של מנטוריות —
            עד ערב גמר שבו הפתרונות עולים לבמה.
          </p>
        </div>
      </section>

      {/* ── how it works for a partner ─────────────────────────────────── */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display font-black text-[26px] text-center mb-8">ככה זה עובד — בשלושה צעדים</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {FLOW.map((f, i) => (
              <div
                key={i}
                className={`bg-white border-2 border-ink-900/10 shadow-[4px_5px_0_0_#F3C6DD] p-6 ${i % 2 ? "md:rotate-1" : "md:-rotate-1"} hover:rotate-0 transition-transform`}
                style={{ borderRadius: "24px 20px 26px 22px" }}
              >
                <div className="text-[34px] mb-2">{f.emoji}</div>
                <div className="font-display font-black text-[19px] mb-1.5">{f.title}</div>
                <p className="t-body text-[15.5px] text-ink-700 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── what partners get ──────────────────────────────────────────── */}
      <section className="px-6 pb-16 bg-tint-purple/25 pt-14">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display font-black text-[26px] text-center mb-8">מה יוצא לכם מזה</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {VALUE.map((v, i) => (
              <div
                key={i}
                className={`bg-white border-2 border-ink-900/10 shadow-[4px_5px_0_0_#D9CBF2] p-6 ${i % 2 ? "md:-rotate-1" : "md:rotate-1"} hover:rotate-0 transition-transform`}
                style={{ borderRadius: "20px 26px 22px 24px" }}
              >
                <div className="text-[34px] mb-2">{v.emoji}</div>
                <div className="font-display font-black text-[19px] mb-1.5">{v.title}</div>
                <p className="t-body text-[15.5px] text-ink-700 leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── social proof ───────────────────────────────────────────────── */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-5">
          <span className="font-mono text-sm text-brand-pink-deep">&lt;כבר בפנים/&gt;</span>
          <h2 className="font-display font-black text-[24px]">האתגר הראשון כבר על הבמה</h2>
          <p className="t-body text-[17px] text-ink-700 max-w-lg">
            המעבדה המרכזית לנגיפים של משרד הבריאות במרכז הרפואי שיבא הביאה אתגר אמיתי מהשטח —
            והמפתחות שלנו כבר מחכות לו.
          </p>
          <div className="flex items-center gap-5 flex-wrap justify-center">
            <span className="bg-white border border-ink-100 rounded-[18px] px-6 py-3 shadow-sm -rotate-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/hackathon-2026/logo-moh.jpg" alt="משרד הבריאות" className="h-16 w-auto" />
            </span>
            <span className="bg-white border border-ink-100 rounded-full p-3 shadow-sm rotate-2 w-24 h-24 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/hackathon-2026/logo-virology.png" alt="המעבדה המרכזית לנגיפים" className="w-full h-full object-contain" />
            </span>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="relative px-6 py-16 text-center overflow-hidden">
        <div aria-hidden className="hp-blob absolute -bottom-24 -right-16 w-80 h-80 bg-tint-pink/50 -z-10" />
        <div className="max-w-xl mx-auto flex flex-col items-center gap-5">
          <h2 className="font-display font-black text-[30px] md:text-[34px] leading-tight">
            רוצים אתגר משלכם על הבמה?
          </h2>
          <p className="t-body text-[17.5px] text-ink-700">
            מקומות השותפות לאירוע מוגבלים — נשמח לספר יותר ולתפור יחד את האתגר שלכם.
          </p>
          <a
            href="https://wa.me/97225800296?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%A0%D7%97%D7%A0%D7%95%20%D7%9E%D7%AA%D7%A2%D7%A0%D7%99%D7%99%D7%A0%D7%99%D7%9D%20%D7%91%D7%A9%D7%95%D7%AA%D7%A4%D7%95%D7%AA%20%D7%91%D7%94%D7%90%D7%A7%D7%AA%D7%95%D7%9F"
            target="_blank"
            rel="noopener noreferrer"
            className="hp-float inline-flex items-center gap-2 bg-brand-gradient text-white font-display font-bold text-[19px] px-8 py-4 rounded-full shadow-glow-pink hover:brightness-105 transition-[filter]"
          >
            💬 דברו איתנו
          </a>
          <p className="font-mono text-[13px] text-ink-400" dir="ltr">
            02-580-0296 · opencode.org.il
          </p>
        </div>
      </section>
    </main>
  );
}
