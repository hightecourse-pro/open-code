// האקתון AI 2026 - the partners & sponsors variant (the owner, 6/9):
// identical to the main page from the hero through the challenges (both
// render shared.tsx), and where the main page tells a junior how she
// participates, this one explains the value of the event to a partner -
// in the same playful doodle style. Goal: recruiting partnerships.
import type { Metadata } from "next";
import {
  H26Style,
  HeroSection,
  TickerStrip,
  ChallengesSection,
  HackathonFooter,
  Sparkle,
  Squiggle,
  CurlyArrow,
  SwirlArrow,
  Wave,
} from "../shared";

export const metadata: Metadata = {
  title: "האקתון AI קוד פתוח 2026 - לשותפים ולספונסרים",
  description: "אתגר אמיתי שלכם, עשרות מפתחות AI, ופתרונות עובדים - בואו להיות שותפים.",
};

// The value story, told as the same zigzag doodle path the main page uses
// for "ככה את ניגשת לאתגר" - here it answers the partner's question.
const VALUE_PATH = [
  {
    emoji: "🤔",
    title: "איך ג׳וניורית מוכיחה מה היא באמת יודעת?",
    body: "זו השאלה שבלב האתגר של ג׳וניוריות בהייטק - אין שנתיים ניסיון בקורות החיים, אבל יש יכולות אמיתיות.",
    side: "self-start",
    tilt: "-rotate-1",
  },
  {
    emoji: "💡",
    title: "התשובה שלנו: מוכיחים במעשים",
    body: "ההאקתון הופך כל ג׳וניורית בקהילה למפתחת AI רלוונטית - עם פתרון עובד שמדבר בשמה, במקום עוד שורה בקורות החיים.",
    side: "self-end",
    tilt: "rotate-1",
    highlight: true,
  },
  {
    emoji: "🧩",
    title: "דרך אחת להיות בפנים: מביאים אתגר",
    body: "בעיה אמיתית מהשטח שלכם - מסמכים, דאטה, תהליך שמבקש אוטומציה. אנחנו עוזרות למסגר אותה כאתגר, ועשרות מפתחות בונות לה פתרון עובד.",
    side: "self-start",
    tilt: "rotate-1",
  },
  {
    emoji: "🧲",
    title: "ודרך שנייה: באים לגייס",
    body: "פוגשים את המפתחות דרך הפתרונות שהן בנו - יכולות מוכחות במקום קורות חיים. בערב הגמר, או ישירות דרכנו 💜",
    side: "self-end",
    tilt: "-rotate-1",
  },
];

const VALUE_CARDS = [
  { emoji: "🔍", title: "גישה מוקדמת לטאלנט", body: "אתם פוגשים את המפתחות החזקות לפני כולם - לא דרך קורות חיים, דרך פתרונות עובדים שהן בנו במו ידיהן.", tilt: "-rotate-2" },
  { emoji: "⚡", title: "עשרות זוויות על בעיה אחת", body: "אותו אתגר, פתרונות שונים - מגוון גישות הנדסיות שקשה להשיג בכל דרך אחרת.", tilt: "rotate-1" },
  { emoji: "💜", title: "שותפות עם משמעות", body: "שער כניסה להייטק לנשים חרדיות מוכשרות - סיפור השפעה אמיתי שהשם שלכם חתום עליו.", tilt: "-rotate-1" },
];

const WA_LINK =
  "https://wa.me/97225800296?text=%D7%A9%D7%9C%D7%95%D7%9D%2C%20%D7%90%D7%A0%D7%97%D7%A0%D7%95%20%D7%9E%D7%AA%D7%A2%D7%A0%D7%99%D7%99%D7%A0%D7%99%D7%9D%20%D7%91%D7%A9%D7%95%D7%AA%D7%A4%D7%95%D7%AA%20%D7%91%D7%94%D7%90%D7%A7%D7%AA%D7%95%D7%9F";

export default function HackathonPartnersPage() {
  return (
    <main className="min-h-full bg-white text-ink-1000 overflow-x-hidden">
      <H26Style />
      <HeroSection variant="partners" />
      <TickerStrip />
      <ChallengesSection />

      <Wave flip tint="#FBF7FF" />

      {/* ─────────────────── the value, for partners ─────────────────── */}
      <section className="px-6 py-16 relative">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-4">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;לשותפים/&gt;</span>
            <h2 className="font-display text-[30px] font-black mt-1 rotate-1">למה כדאי לכם להיות בפנים?</h2>
            <p className="t-body text-ink-700 mt-1.5">
              רגע לפני המספרים והלוגואים - הסיפור האמיתי <span className="h26-wiggle">👀</span>
            </p>
          </div>
          <div className="flex justify-start ps-6 -mb-2 items-start">
            <span className="font-display font-bold text-[15.5px] text-brand-purple rotate-6 ms-1 mt-2">מתחיל כאן</span>
            <SwirlArrow className="h26-float w-14 h-12 -scale-x-100" />
          </div>

          {/* zigzag doodle path - the question, the answer, and your part in it */}
          <div className="flex flex-col">
            {VALUE_PATH.map((a, i) => (
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
                    <span className="block font-display font-black text-[20px] leading-snug">{a.title}</span>
                    <span className="block t-body text-ink-700 mt-1">{a.body}</span>
                  </span>
                </div>
                {i < VALUE_PATH.length - 1 && (
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

          {/* one playful mono line, partner-flavored */}
          <p
            className="font-mono text-[15.5px] text-ink-500 bg-ink-50 border border-dashed border-ink-300 px-4 py-2.5 mt-8 w-fit mx-auto rotate-1"
            style={{ borderRadius: "14px 18px 14px 20px" }}
          >
            {"// bring(realChallenge) => meet(provenTalent) 🚀"}
          </p>

          {/* the simple math - same plus-doodle as "מה בונים?" on the main page */}
          <div className="mt-16 relative">
            <Sparkle className="absolute -top-2 left-[12%] w-5 h-5" color="#E0418D" delay="0.7s" />
            <div className="flex items-end justify-center gap-1 mb-2">
              <span className="font-display font-black text-[26px] text-ink-1000 -rotate-3">
                החשבון פשוט
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
                  <span className="h26-wiggle">🧩</span>
                </span>
                <h3 className="font-display font-black text-[17px] mt-2">אתגר אמיתי שלכם</h3>
                <p className="t-body text-ink-700 mt-1">בעיה מהשטח - מסמכים, דאטה, תהליך שמחכה לאוטומציה.</p>
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
                  <span className="h26-wiggle">👩‍💻</span>
                </span>
                <h3 className="font-display font-black text-[17px] mt-2">עשרות מפתחות AI</h3>
                <p className="t-body text-ink-700 mt-1">כל אחת בונה מנוע AI וממשק בענן - בליווי מנטוריות מהתעשייה.</p>
              </div>
            </div>

            <p className="text-center font-display font-bold text-[16.5px] text-brand-purple mt-5 rotate-1">
              = פתרונות עובדים, והטאלנט הבא שלכם <Sparkle className="inline-block w-4 h-4 align-[-2px]" color="#F0B429" />
            </p>
          </div>
        </div>
      </section>

      <Wave tint="#FDF3F9" />

      {/* ─────────────────── what a partner gets + CTA ─────────────────── */}
      <section className="px-6 pt-6 pb-16 bg-[#FDF3F9] relative">
        <Sparkle className="absolute top-10 right-[12%] w-5 h-5" delay="0.9s" />
        <Sparkle className="absolute bottom-16 left-[10%] w-4 h-4" color="#E0418D" delay="1.7s" />
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;מה יוצא לכם/&gt;</span>
            <h2 className="font-display text-[30px] font-black mt-1 -rotate-1">שלוש סיבות טובות להצטרף</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {VALUE_CARDS.map((v, i) => (
              <div
                key={v.title}
                className={`bg-white border-2 border-ink-900/10 p-5 text-center ${v.tilt} hover:rotate-0 transition-transform shadow-[4px_5px_0_0_#EDE4F7]`}
                style={{ borderRadius: i % 2 ? "20px 26px 22px 28px" : "26px 20px 28px 22px" }}
              >
                <div
                  className="w-11 h-11 mx-auto bg-brand-gradient text-white text-[22px] flex items-center justify-center rotate-6"
                  style={{ borderRadius: "48% 52% 55% 45% / 50% 45% 55% 50%" }}
                >
                  <span className="h26-wiggle" style={{ animationDelay: `${i * 0.6}s` }}>{v.emoji}</span>
                </div>
                <h3 className="font-display font-black text-[17px] mt-2">{v.title}</h3>
                <p className="t-body text-ink-700 mt-1">{v.body}</p>
              </div>
            ))}
          </div>

          {/* the glittering finale - the partnership ask */}
          <div
            className="mt-12 mx-auto max-w-xl bg-brand-gradient text-white text-center p-6 rotate-1 shadow-[6px_7px_0_0_#DDC9EC] relative overflow-hidden"
            style={{ borderRadius: "28px 22px 30px 24px" }}
          >
            <Sparkle className="absolute top-3 right-6 w-5 h-5" color="#FFFFFF" />
            <Sparkle className="absolute bottom-4 left-8 w-4 h-4" color="#F8D98C" delay="1.1s" />
            <Sparkle className="absolute top-8 left-1/4 w-3 h-3" color="#FFFFFF" delay="0.5s" />
            <div className="text-[30px]"><span className="h26-wiggle">🤝</span></div>
            <div className="font-display font-black text-[22px] mt-1">אתגר על הבמה? באים לגייס? ✨</div>
            <div className="font-display font-bold text-[16.5px] mt-1 opacity-95">
              מקומות השותפות לאירוע מוגבלים - נשמח לתפור יחד את השותפות שנכונה לכם 🏆
            </div>
          </div>

          <div className="text-center mt-10 flex flex-col items-center gap-3 relative">
            <CurlyArrow className="w-12 h-14 absolute -top-12 right-[26%] rotate-[24deg] hidden sm:block" color="#7C3AED" />
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="h26-bounce inline-flex items-center gap-2 bg-brand-gradient text-white px-7 py-3.5 font-display font-bold text-[17.5px] -rotate-1 shadow-glow-pink hover:brightness-105 transition-[filter]"
              style={{ borderRadius: "999px" }}
            >
              💬 דברו איתנו על שותפות
            </a>
            <p className="font-mono text-[14px] text-ink-500" dir="ltr">
              02-580-0296 ·{" "}
              <a href="mailto:office@opencode.org.il" className="hover:text-brand-purple hover:underline">
                office@opencode.org.il
              </a>
            </p>
          </div>
        </div>
      </section>

      <HackathonFooter />
    </main>
  );
}
