// האקתון AI קוד פתוח 2026 — the standalone event page (the owner, 1/9).
// UNLINKED on purpose: reachable by direct URL only, until the owner decides
// to link it from the community hackathon page (and possibly open it up
// externally). Design: brand colors, playful-technological, code motifs.
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata: Metadata = {
  title: "האקתון AI קוד פתוח 2026",
  description: "אתגרי AI אמיתיים מהתעשייה — בונות פתרון, אנחנו מלוות. למנויות הקהילה.",
};

/** One partner challenge tile. The three TBD ones tease until announced. */
type Challenge = {
  short: string;
  org: string | null;
  emoji: string;
  challenge?: string;
  samples?: boolean;
};

const CHALLENGES: Challenge[] = [
  {
    short: "המעבדה המרכזית לנגיפים",
    org: "משרד הבריאות · שיבא",
    emoji: "🧬",
    challenge:
      "חילוץ מידע על המטופל מתוך טפסי 17 שמגיעים בפורמטים שונים ומשונים — סרוקים, מצולמים, מודפסים וכתובים ביד. המנוע שלכן צריך לקבל טופס ולהחזיר את פרטי המטופל בצורה מובנית ואמינה.",
    samples: true,
  },
  { short: "שת\"פ יוכרז בקרוב", org: null, emoji: "🤫" },
  { short: "שת\"פ יוכרז בקרוב", org: null, emoji: "🎁" },
  { short: "שת\"פ יוכרז בקרוב", org: null, emoji: "🚀" },
];

const STEPS = [
  { title: "בוחרות אתגר", body: "עוברות על ארבעת האתגרים ובוחרות את זה שמדליק אתכן." },
  { title: "ממלאות טופס בחירה", body: "רישום קצר — הטופס ייפתח כאן ברגע שההרשמה תעלה." },
  { title: "מקבלות את החומרים", body: "לכל אתגר יישלחו תכנים ודוגמאות רלוונטיות, לפי הצורך." },
];

export default function Hackathon2026Page() {
  return (
    <main className="min-h-full bg-white text-ink-1000 overflow-x-hidden">
      {/* ───────────────────────────── hero ───────────────────────────── */}
      <section className="relative px-6 pt-14 pb-16 text-center">
        <div className="bg-brand-glow absolute inset-0 -z-10" />
        {/* playful floating code bits */}
        <span aria-hidden className="absolute top-10 right-[8%] font-mono text-[13px] text-brand-pink-deep/60 rotate-6 select-none">
          {"while (challenge) { build(); }"}
        </span>
        <span aria-hidden className="absolute top-32 left-[6%] font-mono text-[13px] text-brand-purple/60 -rotate-6 select-none">
          {"agent.solve(realProblem)"}
        </span>
        <span aria-hidden className="absolute bottom-10 right-[14%] font-mono text-[12px] text-ink-400 rotate-3 select-none">
          {"// אתן בונות. אנחנו מלוות."}
        </span>

        <div className="max-w-2xl mx-auto flex flex-col items-center gap-5">
          <Link href="/">
            <Logo width={150} />
          </Link>
          <span className="font-mono text-xs text-brand-pink-deep">&lt;hackathon/&gt;</span>
          <h1 className="font-display text-[40px] sm:text-[52px] font-black leading-[1.05]">
            האקתון <span className="t-gradient">AI</span> קוד פתוח
            <span className="block text-[28px] sm:text-[34px] mt-1 text-ink-700 font-black tracking-wide">2026</span>
          </h1>
          <p className="t-body-lg text-ink-700 max-w-lg">
            אתגרי AI אמיתיים מארגונים אמיתיים. בוחרות אתגר, בונות פתרון עובד — ואנחנו איתכן בכל
            צעד.
          </p>
          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <span className="bg-ink-1000 text-white px-3.5 py-1.5 rounded-full text-[13px] font-bold">
              📅 אחרי החגים
            </span>
            <span className="bg-brand-gradient text-white px-3.5 py-1.5 rounded-full text-[13px] font-bold">
              💜 למנויות הקהילה בלבד
            </span>
            <span className="bg-white border-[1.5px] border-brand-purple text-brand-purple px-3.5 py-1.5 rounded-full text-[13px] font-bold">
              🏆 שת"פים מהתעשייה
            </span>
          </div>
        </div>
      </section>

      {/* ─────────────────── the four challenges, around the core ─────────────────── */}
      <section className="px-6 py-14 bg-white border-y border-ink-200">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;אתגרים/&gt;</span>
            <h2 className="font-display text-[28px] font-black mt-1">ארבעה שת"פים. ארבעה אתגרים.</h2>
            <p className="t-body text-ink-700 mt-1">
              כל ארגון מביא בעיה אמיתית מהשטח — לחצי על אתגר כדי לקרוא אותו.
            </p>
          </div>

          <div className="relative">
            {/* the AI core — the four partners orbit it */}
            <div
              aria-hidden
              className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none"
            >
              <div className="w-28 h-28 rounded-full bg-brand-gradient text-white flex flex-col items-center justify-center shadow-glow-pink font-display font-black">
                <span className="text-[22px] leading-none">AI</span>
                <span className="text-[13px] mt-0.5">2026</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-x-40 md:gap-y-16">
              {CHALLENGES.map((c, i) => (
                <div key={i}>
                  {c.challenge ? (
                    <details className="group bg-ink-50 border-2 border-ink-200 rounded-[18px] open:border-brand-pink open:bg-white open:shadow-glow-pink transition-all">
                      <summary className="list-none cursor-pointer p-5 flex items-center gap-3.5 [&::-webkit-details-marker]:hidden">
                        <span className="w-12 h-12 rounded-[14px] bg-brand-gradient text-white text-[22px] flex items-center justify-center shrink-0">
                          {c.emoji}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-display font-black text-[16.5px] leading-tight">
                            {c.short}
                          </span>
                          {c.org && <span className="block text-[12.5px] text-ink-500 mt-0.5">{c.org}</span>}
                        </span>
                        <span className="font-mono text-brand-pink-deep text-sm group-open:rotate-90 transition-transform">
                          &gt;
                        </span>
                      </summary>
                      <div className="px-5 pb-5 pt-0 flex flex-col gap-3">
                        <div className="font-mono text-[11.5px] text-brand-pink-deep">// האתגר</div>
                        <p className="t-body-sm text-ink-900 leading-relaxed">{c.challenge}</p>
                        {c.samples && (
                          <span className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-ink-500 bg-ink-50 border border-dashed border-ink-300 rounded-md px-3 py-1.5">
                            📄 טפסי דוגמה להורדה — יעלו כאן עם פתיחת ההרשמה
                          </span>
                        )}
                      </div>
                    </details>
                  ) : (
                    <div className="bg-ink-50 border-2 border-dashed border-ink-200 rounded-[18px] p-5 flex items-center gap-3.5 opacity-80">
                      <span className="w-12 h-12 rounded-[14px] bg-white border border-ink-200 text-[22px] flex items-center justify-center shrink-0">
                        {c.emoji}
                      </span>
                      <span className="flex-1">
                        <span className="block font-display font-black text-[16.5px] text-ink-500">
                          {c.short}
                        </span>
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

      {/* ─────────────────────── how to approach an AI challenge ─────────────────────── */}
      <section className="px-6 py-14">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;איך ניגשים/&gt;</span>
            <h2 className="font-display text-[28px] font-black mt-1">ככה ניגשים לאתגר AI</h2>
          </div>
          {/* terminal-style guide — the playful-tech centerpiece */}
          <div className="rounded-[18px] overflow-hidden border border-ink-200 shadow-sm" dir="ltr">
            <div className="bg-ink-1000 px-4 py-2.5 flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-brand-pink" />
              <span className="w-3 h-3 rounded-full bg-[#F8D98C]" />
              <span className="w-3 h-3 rounded-full bg-tint-mint" />
              <span className="font-mono text-[12px] text-white/70 ms-3">open-code ~ hackathon</span>
            </div>
            <div className="bg-[#1B1430] p-5 font-mono text-[13.5px] leading-7 text-white/90" dir="rtl">
              <p>
                <span className="text-brand-pink">$</span> מתייעצות עם כלי AI על האתגר — מפרקות את
                הבעיה יחד איתו לצעדים
              </p>
              <p>
                <span className="text-brand-pink">$</span> בונות איג'נט: מנוע AI שמקבל קלט, חושב,
                ומחזיר פתרון
              </p>
              <p>
                <span className="text-brand-pink">$</span> לא יודעות מאיפה להתחיל? <b>הסשנים של
                הקהילה</b> הם בדיוק המקום — סדר בעולמות ה-AI, פיתוח איג'נטים ועוד
              </p>
              <p>
                <span className="text-brand-pink">$</span> מתחילות לבנות — ואנחנו נדאג
                למנטוריות שילוו אתכן לאורך הדרך 💜
              </p>
              <p className="text-white/50">// טיפ: רישיון לכלי AI רציני כמו Claude Code שווה את זה — הוא בונה איתכן את הפרויקט</p>
            </div>
          </div>

          {/* what you actually build */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            <div className="bg-tint-purple/50 border border-[#DDC9EC] rounded-[16px] p-5">
              <div className="text-[26px] mb-1.5">🧠</div>
              <h3 className="font-display font-black text-[16px]">מנוע AI</h3>
              <p className="t-body-sm text-ink-700 mt-1">
                הלב של הפרויקט — מקבל את הבעיה של הארגון ומחזיר פתרון אמיתי.
              </p>
            </div>
            <div className="bg-tint-pink/40 border border-[#F3C6DD] rounded-[16px] p-5">
              <div className="text-[26px] mb-1.5">☁️</div>
              <h3 className="font-display font-black text-[16px]">ממשק בענן</h3>
              <p className="t-body-sm text-ink-700 mt-1">
                UI שאפשר לגשת אליו מכל מקום ולראות את הפתרון עובד — ככה השופטות והארגון פוגשים אותו.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────── the steps ─────────────────────────── */}
      <section className="px-6 py-14 bg-white border-t border-ink-200">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;נרשמות/&gt;</span>
            <h2 className="font-display text-[28px] font-black mt-1">שלושה צעדים ואת בפנים</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="bg-ink-50 border border-ink-200 rounded-[16px] p-5 text-center">
                <div className="w-9 h-9 mx-auto rounded-full bg-brand-gradient text-white font-display font-black flex items-center justify-center">
                  {i + 1}
                </div>
                <h3 className="font-display font-black text-[15.5px] mt-2.5">{s.title}</h3>
                <p className="t-body-sm text-ink-700 mt-1">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10 flex flex-col items-center gap-3">
            <span className="inline-flex items-center gap-2 bg-ink-50 border border-dashed border-ink-300 rounded-full px-5 py-2.5 font-display font-bold text-[14.5px] text-ink-500">
              🔒 טופס הבחירה ייפתח כאן ממש בקרוב
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

      <footer className="px-6 py-8 text-center text-ink-500 text-sm border-t border-ink-200">
        קוד פתוח · השמה. הכשרה. תרבות 💜 ·{" "}
        <span className="font-mono text-[12px] text-brand-pink-deep">האקתון AI 2026</span>
      </footer>
    </main>
  );
}
