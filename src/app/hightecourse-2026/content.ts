/*
  The third day of Hightecourse 2026 - the program, word for word from the
  printed brochure (Thursday | ט״ז כסלו | 26.11), and the page's copy. The
  handwritten lines of the brochure are kept as "hand". The brochure's 15:00
  ״חלוקת תעודות״ is left out on the owner's word (18.11: ״זה לא רלוונטי״).
*/
export interface ScheduleItem {
  time: string;
  title: string;
  sub?: string;
  hand?: string;
  /** Names set in navy on the brochure - marked on the page. */
  names?: string[];
  /** One word of the title set bigger (the owner: ״תגדיל את המילה שבת״). */
  big?: string;
  /** A speaker's logo shown in the row. */
  logo?: { src: string; alt: string; width: number; height: number };
}

/** The speakers - marked wherever they appear. */
export const NAMES = ["נירית כהן", "שירי נשיא", "אסתי בר נתן"];

export const SCHEDULE: ScheduleItem[] = [
  { time: "08:00", title: "התכנסות ובופה בוקר עשיר" },
  { time: "08:45", title: "עמדת השפעה.", sub: "תני את הטאץ׳ שלך" },
  { time: "09:00", title: "המסע אל אי השפיות.", sub: "משחק קבוצתי אתגרי" },
  {
    time: "11:00",
    title: "בדרך לעולם של פחות עבודה.",
    sub: "נירית כהן - עולם העבודה העתידי",
    names: ["נירית כהן"],
    logo: { src: "/hightecourse-2026/nirit-cohen.png", alt: "נירית כהן - עולם העבודה העתידי", width: 162, height: 49 },
  },
  { time: "12:15", title: "על מי אני עובדת?", sub: "מונודרמה סטירית על החיים בגרסה משופרת.", hand: "אל תגידי עוד רגע..." },
  { time: "13:15", title: "הגרלות 2026", sub: "מי הזוכות שלנו הפעם?" },
  { time: "13:45", title: "ארוחת צהריים בשרית" },
  { time: "15:15", title: "למה לא כל יום שבת.", big: "שבת", sub: "שירי נשיא מארחת את אסתי בר נתן למופע שכולו עונג שבת", names: ["שירי נשיא", "אסתי בר נתן"], hand: "ליווי מוזיקלי מורחב" },
  { time: "17:00", title: "ניפגש בשנה הבאה (:" },
];

/** The yellow band's loop. */
export const MARQUEE = ["בופה בוקר עשיר", "משחק קבוצתי אתגרי", "נירית כהן", "מונודרמה סטירית", "הגרלות 2026", "מופע עונג שבת", "ארוחת צהריים בשרית"];
