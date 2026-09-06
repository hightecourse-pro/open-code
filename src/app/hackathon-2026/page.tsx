// האקתון AI קוד פתוח 2026 - the standalone event page (the owner, 1/9).
// UNLINKED on purpose: reachable by direct URL only, until the owner decides
// to link it from the community hackathon page (and possibly open it up
// externally). Design round 3 (the owner: "יותר שובב, חיצים מאוירים
// מסולסלים, אנימציות") - curly drawn arrows, floating sparkles, breathing
// blobs, a wobbling core, a code ticker; prefers-reduced-motion stills it all.
// Hero/ticker/challenges live in shared.tsx - kept identical with /partners.
import type { Metadata } from "next";
import Link from "next/link";
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
} from "./shared";

export const metadata: Metadata = {
  title: "האקתון AI קוד פתוח 2026",
  description: "אתגרי AI אמיתיים מהתעשייה - בונות פתרון, אנחנו מלוות. למנויות הקהילה.",
};

const STEPS = [
  { emoji: "🎯", title: "בוחרת אתגר", body: "עוברת על ארבעת האתגרים ובוחרת את זה שמדליק אותך.", tilt: "-rotate-2" },
  { emoji: "📝", title: "ממלאה טופס בחירה", body: "רישום קצר - הטופס ייפתח בקהילה ברגע שההרשמה תעלה.", tilt: "rotate-1" },
  { emoji: "📦", title: "מקבלת את החומרים", body: "לאתגר שבחרת יישלחו אלייך תכנים ודוגמאות רלוונטיות.", tilt: "-rotate-1" },
  { emoji: "🛠️", title: "מפתחת ויוצרת", body: "בונה את המנוע ואת הממשק - עם כלי ה-AI והמנטוריות שלצידך.", tilt: "rotate-2" },
  { emoji: "🏆", title: "מתמודדת על הזכייה", body: "מגישה את הפתרון שעבדת עליו ונלחמת על המקום הראשון בארוע.", tilt: "-rotate-1" },
];

// How you approach an AI challenge - a zigzag doodle path, לשון נוכחת
// (the owner, 31/8: redesign + "גם אם לא למדת קורס AI מלא").
const APPROACH = [
  {
    emoji: "🗺️",
    title: "מתייעצת עם ה-AI",
    body: "זורקת לו את האתגר ומפרקת את הבעיה יחד איתו לצעדים קטנים - עוד לפני שורת קוד אחת.",
    side: "self-start",
    tilt: "-rotate-1",
  },
  {
    emoji: "🎓",
    title: "לא יודעת מאיפה להתחיל?",
    body: "הסשנים של הקהילה הם בדיוק נקודת הפתיחה - סדר בעולמות ה-AI, פיתוח איג'נטים ועוד.",
    side: "self-end",
    tilt: "rotate-1",
  },
  {
    emoji: "🧑‍🏫",
    title: "בחרת שיטה? תני ל-AI ללמד אותך",
    body: "ברגע שבחרת שיטה - בקשי מה-AI שילמד אותך איך בדיוק היא עובדת, צעד אחרי צעד. ככה יהיה לך הרבה יותר קל לפתור בעיות שתיתקלי בהן בדרך.",
    side: "self-start",
    tilt: "rotate-1",
    highlight: true,
  },
  {
    emoji: "🤖",
    title: "בונה איג'נט",
    body: "מנוע AI שמקבל קלט, חושב, ומחזיר פתרון - ומנטוריות מהקהילה ילוו אותך לאורך כל הדרך 💜",
    side: "self-end",
    tilt: "-rotate-1",
  },
];

export default function Hackathon2026Page() {
  return (
    <main className="min-h-full bg-white text-ink-1000 overflow-x-hidden">
      <H26Style />
      <HeroSection />
      <TickerStrip />
      <ChallengesSection />

      <Wave flip tint="#FBF7FF" />

      {/* ─────────────────── how to approach an AI challenge ─────────────────── */}
      <section className="px-6 py-16 relative">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-4">
            <span className="font-mono text-xs text-brand-pink-deep">&lt;איך ניגשים/&gt;</span>
            <h2 className="font-display text-[30px] font-black mt-1 rotate-1">ככה את ניגשת לאתגר AI</h2>
            <p className="t-body text-ink-700 mt-1.5">
              גם אם לא למדת קורס AI מלא <span className="h26-wiggle">😉</span> - ה-AI הוא גם הכלי וגם המורה שלך.
            </p>
          </div>
          <div className="flex justify-start ps-6 -mb-2 items-start">
            <span className="font-display font-bold text-[15.5px] text-brand-purple rotate-6 ms-1 mt-2">מתחילה כאן</span>
            <SwirlArrow className="h26-float w-14 h-12 -scale-x-100" />
          </div>

          {/* zigzag doodle path - each stop leans the other way, swirl arrows in between */}
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
                    <span className="block font-display font-black text-[20px] leading-snug">{a.title}</span>
                    <span className="block t-body text-ink-700 mt-1">{a.body}</span>
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

          {/* the code-flavored tip stays - one playful mono line */}
          <p
            className="font-mono text-[15.5px] text-ink-500 bg-ink-50 border border-dashed border-ink-300 px-4 py-2.5 mt-8 w-fit mx-auto rotate-1"
            style={{ borderRadius: "14px 18px 14px 20px" }}
          >
            {"// טיפ: רישיון לכלי AI רציני כמו Claude Code שווה את זה - הוא בונה איתך את הפרויקט 🚀"}
          </p>

          {/* מה בונים? - the two halves of the project, joined by a drawn plus
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
                <p className="t-body text-ink-700 mt-1">הלב של הפרויקט - מקבל את הבעיה של הארגון ומחזיר פתרון אמיתי.</p>
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
                <p className="t-body text-ink-700 mt-1">UI שאפשר לגשת אליו מכל מקום ולראות את הפתרון עובד - ככה השופטות והארגון פוגשים אותו.</p>
              </div>
            </div>

            <p className="text-center font-display font-bold text-[16.5px] text-brand-purple mt-5 rotate-1">
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
            <h2 className="font-display text-[30px] font-black mt-1 -rotate-1">5 צעדים - ויש לך פרויקט AI משמעותי משלך</h2>
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
                <p className="t-body text-ink-700 mt-1">{s.body}</p>
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
            <div className="font-display font-bold text-[16.5px] mt-1 opacity-95">
              באמצע חשוון - הקהילה חוגגת, והזוכות עולות לבמה 🏆
            </div>
          </div>

          <div className="text-center mt-10 flex flex-col items-center gap-3 relative">
            <CurlyArrow className="w-12 h-14 absolute -top-12 right-[26%] rotate-[24deg] hidden sm:block" color="#7C3AED" />
            <span
              className="h26-bounce inline-flex items-center gap-2 bg-white border-2 border-dashed border-brand-pink/50 px-6 py-3 font-display font-bold text-[16.5px] text-ink-700 -rotate-1 shadow-[4px_5px_0_0_#F3C6DD]"
              style={{ borderRadius: "999px" }}
            >
              🔒 טופס הבחירה ייפתח בקהילה ממש בקרוב
            </span>
            <p className="t-body text-ink-500 max-w-md">
              ההשתתפות למנויות הקהילה בלבד - עוד לא איתנו?{" "}
              <Link href="/join" className="font-semibold text-brand-purple hover:underline">
                מצטרפות כאן
              </Link>{" "}
              💜
            </p>
          </div>
        </div>
      </section>

      <HackathonFooter />
    </main>
  );
}
