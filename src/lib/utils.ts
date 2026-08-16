import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, resolving Tailwind conflicts (last wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// שעון ישראל — מקור אמת יחיד לזמני סשנים.
// The server renders in UTC and a member's browser can sit in any zone, so a
// session time is never formatted or parsed without naming the zone explicitly.
// The offset is derived per date (Israel moves between +02:00 and +03:00), never
// hardcoded.
// ---------------------------------------------------------------------------

export const ISRAEL_TZ = "Asia/Jerusalem";

const ISRAEL_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: ISRAEL_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** The wall clock an Israeli sees at that instant. */
function israelWallClock(date: Date) {
  const p: Record<string, string> = {};
  for (const part of ISRAEL_PARTS.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    // h23 keeps midnight at 00, but guard anyway — some engines emit 24.
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Israel's offset from UTC (ms) at that instant: +2h in winter, +3h in summer. */
function israelOffsetMs(date: Date): number {
  const w = israelWallClock(date);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Turn a `datetime-local` value ("2026-08-20T19:00") typed as *Israel* time into
 * the ISO instant to store. Two passes because the first guess can land on the
 * far side of a DST switch, and the offset there is the wrong one to subtract.
 * On the hour that spring-forward skips this resolves forward (02:30 → 03:30),
 * which is what a calendar should do.
 */
export function israelLocalToIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(local.trim());
  if (!m) return "";
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
  let ts = wall - israelOffsetMs(new Date(wall));
  ts = wall - israelOffsetMs(new Date(ts));
  return new Date(ts).toISOString();
}

/** Inverse of `israelLocalToIso` — fills a `datetime-local` field for editing. */
export function isoToIsraelInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const w = israelWallClock(d);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${w.year}-${p2(w.month)}-${p2(w.day)}T${p2(w.hour)}:${p2(w.minute)}`;
}

/** Hebrew date in Israel time. Default: "יום חמישי, 20 באוגוסט". */
export function fmtIsraelDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }
): string {
  return new Date(iso).toLocaleDateString("he-IL", { ...opts, timeZone: ISRAEL_TZ });
}

/** "19:00" — Israel time, 24h. */
export function fmtIsraelTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ISRAEL_TZ,
  });
}

/** "20 באוג׳, 19:00" — the compact date+time used in lists. */
export function fmtIsraelDateTime(iso: string): string {
  return `${fmtIsraelDate(iso, { day: "numeric", month: "short" })}, ${fmtIsraelTime(iso)}`;
}

const rtf = new Intl.RelativeTimeFormat("he", { numeric: "auto" });

/** Hebrew relative time, e.g. "לפני 3 שעות". Falls back to a date for old items. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 60) return "ממש עכשיו";
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(diffSec / 86400), "day");

  return fmtIsraelDate(iso, { day: "numeric", month: "short" });
}
