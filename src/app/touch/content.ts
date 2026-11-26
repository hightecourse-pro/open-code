// ״תני לנו את הטאצ' שלך״ - the conference questionnaire, in the owner's words (26.11).
// No server imports here: the kiosk, the LED screen and the API all read it.

export type TouchQuestion = { q: string; a: [string, string, string, string] };

export const TOUCH_QUESTIONS: TouchQuestion[] = [
  {
    q: "מה את פותחת קודם כשאת מתחילה לעבוד?",
    a: ["את המיילים שלי", "את סביבת העבודה המקצועית", "את כלי ה-AI שלי", "למה לסגור? הוא פתוח מאתמול"],
  },
  {
    q: "מה יקרה אם מחר בבוקר כל כלי ה-AI יושבתו?",
    a: ["יום עבודה רגיל, פחות או יותר", "אחזור לעבוד בקצב של 2022", "חצי מהמשימות שלי ייתקעו", "עדיף כבר לקחת יום חופש"],
  },
  {
    q: "כמה עבודה את מספיקה ביום?",
    a: ["בערך כמו פעם", "מה שפעם הספקתי בשבוע", "מה שפעם הספקתי בחודש", "כמות שפעם בכלל לא הייתי מעזה לחלום עליה"],
  },
  {
    q: "חסכת שעתיים בזכות ה-AI. מה עשית בהן?",
    a: ["סיימתי לעבוד מוקדם יותר", "השקעתי בלמידה ובהתמקצעות", "לקחתי על עצמי עוד ועוד משימות", "שעתיים? לא ברור לי לאן הן נעלמו"],
  },
  {
    q: "קיבלת מה-AI תוצר שעובד מצוין, אבל לא לגמרי הבנת איך. מה את עושה?",
    a: ["חוקרת עד שאני מבינה כל פרט", "מבינה את העיקר ובודקת שהכול תקין", "אם זה עובד ועבר בדיקות, מתקדמת", "מבקשת מה-AI להסביר לי, וגם את ההסבר נותנת לו לבדוק"],
  },
  {
    q: "מתי לאחרונה ביצעת משימה מקצועית מורכבת לגמרי לבד, בלי AI?",
    a: ["היום", "בשבוע האחרון", "בחודש האחרון", "בתקופה ההיא, לפני שהכול השתנה"],
  },
  {
    q: "איך השתנו הציפיות של המנהלים שלך מאז כניסת ה-AI?",
    a: ["לא השתנו במיוחד", "מצפים שאעבוד מהר יותר", "מצפים שאעשה גם עבודה של בעלי תפקידים נוספים", "מה שפעם היה נס, היום הוא משימה עד הצהריים"],
  },
  {
    q: "מה קרה ליכולות המקצועיות שלך מאז שהתחלת להשתמש ב-AI?",
    a: ["השתדרגתי מקצועית בכל המובנים", "רכשתי יכולות חדשות, אבל קצת החלדתי בישנות", "התוצרים שלי השתפרו יותר מהיכולות שלי", "לפעמים אני לא בטוחה מי מאיתנו המומחית"],
  },
  {
    q: "איך נראה הראש שלך בסוף יום עבודה בעידן ה-AI?",
    a: ["רגוע יותר – סוף סוף יש מי שעוזר", "מסופק יותר – הספקתי המון", "עמוס יותר – הכול קורה במקביל", "38 טאבים פתוחים, ולא רק בדפדפן"],
  },
  {
    q: "אם היית צריכה לעבור היום ראיון עבודה לתפקיד הנוכחי שלך, בלי להשתמש ב-AI?",
    a: ["הייתי עוברת בקלות", "הייתי צריכה קצת להתכונן", "הייתי צריכה ללמוד מחדש לא מעט דברים", "הייתי מנסה לשכנע אותם שזה לא ראיון שמותאם לעידן החדש"],
  },
];

export const TOUCH_Q = TOUCH_QUESTIONS.length;
export const TOUCH_A = 4;

/** What the LED screen reads: counts[q][a] and the number of women who answered at least one question. */
export type TouchResults = { counts: number[][]; total: number; at: number };

export const emptyCounts = (): number[][] => TOUCH_QUESTIONS.map(() => [0, 0, 0, 0]);

/** Whole percents that add up to exactly 100 (largest remainder); all zero when nobody answered. */
export function percents(row: number[]): number[] {
  const sum = row.reduce((s, n) => s + n, 0);
  if (!sum) return row.map(() => 0);
  const exact = row.map((n) => (n * 100) / sum);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((s, n) => s + n, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((x, y) => y.r - x.r);
  for (let k = 0; left > 0; k++, left--) out[order[k % order.length].i]++;
  return out;
}
