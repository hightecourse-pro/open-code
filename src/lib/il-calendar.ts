// Israeli calendar rules for outgoing member email (the owner, 10/9): nothing
// goes out on Shabbat or on a יום טוב, and a send-date that lands on one moves
// EARLIER to the nearest weekday. Uses @hebcal/core with the ISRAEL holiday
// schedule (one-day chagim), so only actual יום-טוב days block — chol hamoed
// and diaspora second days do not.
import { HDate, HebrewCalendar, flags } from "@hebcal/core";

/** "YYYY-MM-DD" of a moment, on the Israel calendar day it falls in. */
export function ymdIL(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function partsOf(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

/** Day-of-week for an IL calendar day (0=Sunday … 6=Saturday). */
function weekdayOf(ymd: string): number {
  const { y, m, d } = partsOf(ymd);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

/** Is this IL calendar day a יום טוב (work-forbidden holiday, Israel schedule)? */
function isChag(ymd: string): boolean {
  const { y, m, d } = partsOf(ymd);
  const events = HebrewCalendar.getHolidaysOnDate(new HDate(new Date(Date.UTC(y, m - 1, d, 12))), true) ?? [];
  return events.some((ev) => (ev.getFlags() & flags.CHAG) !== 0);
}

/** May member email go out on this IL calendar day? */
export function isEmailDay(ymd: string): boolean {
  return weekdayOf(ymd) !== 6 && !isChag(ymd);
}

/** The IL day `days` before/after the given one. */
export function shiftDay(ymd: string, days: number): string {
  const { y, m, d } = partsOf(ymd);
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/**
 * The latest email-eligible day that is on or before the ideal one — a
 * reminder scheduled for Shabbat/chag moves earlier, never later (up to a
 * week of festival days).
 */
export function backToEligible(ymd: string): string {
  let day = ymd;
  for (let i = 0; i < 8 && !isEmailDay(day); i++) day = shiftDay(day, -1);
  return day;
}

/** Hebrew-locale date line for email copy, e.g. "יום ראשון, 14.9.2026". */
export function hebDateLine(ymd: string): string {
  const { y, m, d } = partsOf(ymd);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  const weekday = new Intl.DateTimeFormat("he-IL", { timeZone: "UTC", weekday: "long" }).format(date);
  return `${weekday}, ${d}.${m}.${y}`;
}
