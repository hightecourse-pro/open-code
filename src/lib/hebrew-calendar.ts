// When the community stays quiet: Shabbat and the festivals of Israel.
//
// No dependency and no table to maintain — the Hebrew date comes from the
// platform's own calendar support, evaluated in Jerusalem time. The digest
// runs in the morning, so the civil day and the Hebrew day line up.

const HEBREW_DATE = new Intl.DateTimeFormat("en-u-ca-hebrew", {
  timeZone: "Asia/Jerusalem",
  month: "long",
  day: "numeric",
});

const WEEKDAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  weekday: "short",
});

/** Yom tov as kept in Israel — one day of each, no diaspora second day. */
const FESTIVALS: Record<string, Record<number, string>> = {
  Tishri: {
    1: "ראש השנה",
    2: "ראש השנה",
    10: "יום כיפור",
    15: "סוכות",
    22: "שמיני עצרת ושמחת תורה",
  },
  Nisan: {
    15: "פסח",
    21: "שביעי של פסח",
  },
  Sivan: {
    6: "שבועות",
  },
};

export interface RestDay {
  rest: boolean;
  /** What it is, for the log — "שבת", "פסח"… */
  reason?: string;
}

/**
 * Is this a day we don't send on? Saturday, or one of the festivals above.
 * Defaults to now; take a date for testing.
 */
export function isRestDay(date: Date = new Date()): RestDay {
  if (WEEKDAY.format(date) === "Sat") return { rest: true, reason: "שבת" };

  // "15 Nisan" → month name and day number.
  const parts = HEBREW_DATE.formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = Number(parts.find((p) => p.type === "day")?.value ?? 0);
  const festival = FESTIVALS[month]?.[day];
  if (festival) return { rest: true, reason: festival };

  return { rest: false };
}
