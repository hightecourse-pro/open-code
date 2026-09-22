/**
 * Graduation years the way the owner wants them shown (22/9): always the
 * Hebrew year with gershayim (תשפ"ו), whatever was typed - "5786" (the select's
 * value), "תשפו", "תשע״ט", "2019" (the academic year ending that summer) -
 * and "לא ידוע" for text that is not a year at all.
 */

const UNITS = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const HUNDREDS = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];

const LETTER_VALUE: Record<string, number> = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90,
  ק: 100, ר: 200, ש: 300, ת: 400,
};

/** 5786 → תשפ"ו (the thousands are implied, as people write them). */
export function hebrewYearLabel(year: number): string {
  const n = year % 1000; // 786
  let letters = HUNDREDS[Math.floor(n / 100)] ?? "";
  const rest = n % 100;
  if (rest === 15) letters += "טו";
  else if (rest === 16) letters += "טז";
  else letters += TENS[Math.floor(rest / 10)] + UNITS[rest % 10];
  if (letters.length <= 1) return letters + "'";
  return letters.slice(0, -1) + '"' + letters.slice(-1);
}

/** The select's own option value for a year - what profile_answers stores. */
export function hebrewYearValue(year: number): string {
  return String(year);
}

export interface GradYear {
  /** "5786" - the canonical stored value, or null when unknown. */
  value: string | null;
  /** תשפ"ו - or "לא ידוע". */
  label: string;
  /** What was actually stored, for the team's eyes. */
  raw: string;
}

const MIN = 5740; // 1980 - anything older is not a graduation we track
const MAX = 5800;

export function normalizeGradYear(raw: unknown): GradYear {
  const text = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
  const unknown = { value: null, label: "לא ידוע", raw: text };
  if (!text) return unknown;

  // "5786" - the questionnaire's own value.
  if (/^\d{4}$/.test(text)) {
    const n = Number(text);
    if (n >= MIN && n <= MAX) return { value: String(n), label: hebrewYearLabel(n), raw: text };
    // A Gregorian year: the academic year ends in the summer of that year.
    if (n >= 1980 && n <= 2040) {
      const h = n + 3760;
      return { value: String(h), label: hebrewYearLabel(h), raw: text };
    }
    return unknown;
  }

  // Hebrew letters, with or without gershayim/geresh, possibly followed by a
  // comment ("תשפז- הלימודים נגמרו…"). Take the leading letters only.
  const m = text.replace(/[׳״'"׳״]/g, "").match(/^ה?(ת[א-ת]{1,3})/);
  if (m) {
    const letters = m[1];
    let sum = 0;
    for (const ch of letters) sum += LETTER_VALUE[ch] ?? 0;
    const h = 5000 + sum;
    if (h >= MIN && h <= MAX) return { value: String(h), label: hebrewYearLabel(h), raw: text };
  }
  return unknown;
}

/** The chips: from the coming year back to 1980 - only what exists is shown. */
export function gradYearOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let y = 5790; y >= MIN; y--) out.push({ value: String(y), label: hebrewYearLabel(y) });
  return out;
}
