// The library rule, shared by the action and the screen: the next course swap
// unlocks one month after she TOOK the current course — a rolling month from
// the request itself (the owner's "עבר חודש מבקשת הקורס הקודם"), not a
// calendar month.

export function swapEligibleAt(takenAtIso: string): Date {
  const d = new Date(takenAtIso);
  d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * The team cancelled her choice from the admin screen (the owner, 18/9:
 * "לבטל בחירה של קורס כדי שתוכל לבחור אחד אחר"). A released take does not
 * start the rolling month — she may pick a new course right away.
 * Marker: a returned row whose last_switch_month was cleared (every take
 * written by startCourse sets it, so null only ever means "released").
 * TODO: promote to a released_at column once migrations can run again.
 */
export function releasedByTeam(e: { status: string; last_switch_month: string | null }): boolean {
  return e.status === "returned" && e.last_switch_month === null;
}

export const COURSE_DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Jerusalem",
});
