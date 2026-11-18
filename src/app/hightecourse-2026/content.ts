/*
  The third day of Hightecourse 2026 - the program, word for word from the
  printed brochure (Thursday | ט״ז כסלו | 26.11), and the page's copy. The
  handwritten lines of the brochure are kept as "hand".
*/
export interface ScheduleItem {
  time: string;
  title: string;
  sub?: string;
  hand?: string;
  /** Names set in navy on the brochure. */
  names?: string[];
  /** One of the day's highlights (gets a card above the timeline). */
  highlight?: boolean;
}

export const SCHEDULE: ScheduleItem[] = [
  { time: "08:00", title: "התכנסות ובופה בוקר עשיר" },
  { time: "08:45", title: "עמדת השפעה.", sub: "תני את הטאץ׳ שלך" },
  { time: "09:00", title: "המסע אל אי השפיות.", sub: "משחק קבוצתי אתגרי", highlight: true },
  { time: "11:00", title: "בדרך לעולם של פחות עבודה.", sub: "נירית כהן - עולם העבודה העתידי", names: ["נירית כהן"], highlight: true },
  { time: "12:15", title: "על מי אני עובדת?", sub: "מונודרמה סטירית על החיים בגרסה משופרת.", hand: "אל תגידי עוד רגע...", highlight: true },
  { time: "13:15", title: "הגרלות 2026", sub: "מי הזוכות שלנו הפעם?", highlight: true },
  { time: "13:45", title: "ארוחת צהריים בשרית" },
  { time: "15:00", title: "חלוקת תעודות", highlight: true },
  { time: "15:15", title: "למה לא כל יום שבת.", sub: "שירי נשיא מארחת את אסתי בר נתן למופע שכולו עונג שבת..", names: ["שירי נשיא", "אסתי בר נתן"], hand: "ליווי מוזיקלי מורחב", highlight: true },
  { time: "17:00", title: "ניפגש בשנה הבאה (:" },
];

export const HIGHLIGHTS = SCHEDULE.filter((s) => s.highlight);

/** The yellow band's loop. */
export const MARQUEE = ["בופה בוקר עשיר", "משחק קבוצתי אתגרי", "נירית כהן", "מונודרמה סטירית", "הגרלות 2026", "חלוקת תעודות", "מופע עונג שבת", "ארוחת צהריים בשרית"];
