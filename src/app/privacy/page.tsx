// Privacy policy (the owner, 1/9: "תתאים את המערכת לחוק הגנת הפרטיות") —
// the §11 notice and the full picture of what we hold, why, and who sees it.
// Written to match what the system ACTUALLY does; wording changes here must
// track real behavior (and vice versa).
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "מדיניות פרטיות" };

const UPDATED = "1 בספטמבר 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-[19px] font-black text-ink-1000">{title}</h2>
      <div className="t-body-sm text-ink-700 leading-relaxed flex flex-col gap-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-full bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-8">
        <div className="flex flex-col items-start gap-4">
          <Link href="/">
            <Logo width={140} />
          </Link>
          <div>
            <span className="font-mono text-xs text-brand-pink-deep">&lt;פרטיות/&gt;</span>
            <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">מדיניות פרטיות</h1>
            <p className="t-body-sm text-ink-500 mt-1">עודכן לאחרונה: {UPDATED}</p>
          </div>
          <p className="t-body-sm text-ink-700 leading-relaxed">
            קהילת קוד פתוח היא קהילה, מרכז הכשרה ופלטפורמת השמה למפתחות. כדי לעשות את זה טוב אנחנו
            מחזיקות מידע אישי — והעמוד הזה מסביר בשפה פשוטה איזה מידע, למה, מי רואה אותו, ומה
            הזכויות שלך לפי חוק הגנת הפרטיות, התשמ&quot;א-1981.
          </p>
        </div>

        <Section title="איזה מידע אנחנו אוספות">
          <p>
            <b>בהרשמה:</b> שם, כתובת אימייל וסיסמה (הסיסמה נשמרת מוצפנת ואיננו יכולות לראות אותה).
          </p>
          <p>
            <b>בשאלון הפרופיל:</b> פרטי קשר (טלפון, כתובת ואזור מגורים), תעודת זהות, מצב משפחתי,
            רקע לימודי, שפות, כישורים וטכנולוגיות, ניסיון תעסוקתי ופרקטיקום, קישורים מקצועיים
            (כמו GitHub), קורות חיים והעדפות השמה.
          </p>
          <p>
            <b>במהלך השימוש:</b> תוכן שאת כותבת (פורום, צ&apos;אטים, פניות לצוות), נוכחות ומשוב על
            סשנים, ותיעוד תשלומים (סכום, תאריך ואסמכתא — <b>לא</b> פרטי כרטיס האשראי).
          </p>
        </Section>

        <Section title="מסירת המידע — ולמה אנחנו מבקשות אותו">
          <p>
            אין עלייך חובה חוקית למסור לנו מידע — מסירתו תלויה ברצונך ובהסכמתך. בלי חלק מהפרטים
            (כמו פרופיל מקצועי וקורות חיים) לא נוכל להציע לך משרות, קורסים או ליווי, כי אלה
            בדיוק המטרות שלשמן המידע נאסף: התאמת משרות והגשת מועמדות בשמך, התאמת קורסים
            ומנטוריות, תפעול הקהילה והמנוי, ושמירה על קשר איתך.
          </p>
          <p>המידע שלך לעולם לא נמכר ולא מועבר לגורם שלישי למטרות שיווק.</p>
        </Section>

        <Section title="מי רואה מה">
          <p>
            <b>צוות קוד פתוח</b> — רואה את הפרופיל המלא כדי ללוות אותך ולהגיש אותך למשרות.
          </p>
          <p>
            <b>חברות הקהילה</b> — רואות בספריית המשתתפות רק שם, תחום, אזור וטקסט ההיכרות שכתבת;
            לא פרטי קשר, לא תעודת זהות ולא פרטי תשלום.
          </p>
          <p>
            <b>מעסיקות</b> — רואות רק את השדות המקצועיים שמסומנים להצגה למעסיקים, ורק כשאנחנו
            מגישות אותך למשרה או מציגות אותך בפורטל. פרטים אישיים (תעודת זהות, כתובת מלאה, מצב
            משפחתי, העדפות פנימיות) לעולם אינם מוצגים למעסיקות. אפשר לבקש מאיתנו בכל רגע להסיר
            את הפרופיל מתצוגת המעסיקות.
          </p>
        </Section>

        <Section title="ספקים שמעבדים מידע בשבילנו">
          <p>
            המערכת פועלת על שרתים באיחוד האירופי (Supabase ו-Vercel). מיילים נשלחים דרך Resend;
            תשלומים נסלקים דרך נדרים פלוס (פרטי הכרטיס נשמרים אצלם בלבד); חומרי קורסים משותפים
            דרך Google Drive; ובדיקת קורות החיים בכלי ה-AI נעשית מול Google Gemini — רק כשאת
            מפעילה אותה, ורק על הקובץ שבחרת. כל הספקים מחויבים לאבטחת המידע שהם מעבדים.
          </p>
        </Section>

        <Section title="אבטחת מידע">
          <p>
            הגישה למידע מוגבלת לפי תפקיד ונאכפת גם ברמת בסיס הנתונים; התקשורת מוצפנת (HTTPS);
            מפתחות וסודות נשמרים מוצפנים; והצוות רואה רק את מה שנחוץ לעבודתו. אנחנו פועלות בהתאם
            לתקנות הגנת הפרטיות (אבטחת מידע), התשע&quot;ז-2017.
          </p>
        </Section>

        <Section title="הזכויות שלך">
          <p>
            <b>עיון</b> — כל המידע שמסרת מוצג לך בעמוד הפרופיל, כולל תצוגה מדויקת של איך מעסיקה
            רואה אותך (&quot;לצפיה בפרופיל&quot;).
          </p>
          <p>
            <b>תיקון</b> — אפשר לעדכן כל פרט בכל רגע מעמוד הפרופיל.
          </p>
          <p>
            <b>מחיקה</b> — אפשר לבקש למחוק את החשבון והמידע. חלק מרישומי התשלומים נשמרים גם אחרי
            מחיקה, כנדרש בדין.
          </p>
          <p>
            לכל בקשה — כתבי לנו דרך כפתור &quot;יש לך בקשה?&quot; בתוך המערכת, או השיבי לכל מייל
            שקיבלת מאיתנו. אנחנו עונות מהר 💜
          </p>
        </Section>

        <Section title="עוגיות (Cookies)">
          <p>
            אנחנו משתמשות בעוגיות חיוניות בלבד — כדי לזהות שאת מחוברת. אין עוגיות פרסום ואין
            מעקב של צד שלישי.
          </p>
        </Section>

        <Section title="שינויים במדיניות">
          <p>
            אם המדיניות תתעדכן באופן מהותי, נעדכן את התאריך בראש העמוד ונודיע במערכת. שימוש
            בשירות אחרי העדכון משמעו הסכמה לנוסח המעודכן.
          </p>
        </Section>

        <footer className="border-t border-ink-200 pt-5 text-[13px] text-ink-500">
          קוד פתוח · השמה. הכשרה. תרבות 💜 ·{" "}
          <Link href="/" className="font-semibold text-brand-purple hover:underline">
            לעמוד הבית
          </Link>
        </footer>
      </div>
    </main>
  );
}
