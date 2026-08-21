// The library rule, shared by the action and the screen: the next course swap
// unlocks one month after she TOOK the current course — a rolling month from
// the request itself (the owner's "עבר חודש מבקשת הקורס הקודם"), not a
// calendar month.

export function swapEligibleAt(takenAtIso: string): Date {
  const d = new Date(takenAtIso);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export const COURSE_DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Jerusalem",
});
