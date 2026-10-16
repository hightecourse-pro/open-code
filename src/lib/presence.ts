/**
 * Online presence (the owner, 16/10) - a green or orange dot on every member
 * in the chat and in admin.
 *
 * How it works, and why this way:
 *  - the browser sends a tiny heartbeat (POST /api/presence) when a page loads,
 *    when the tab comes back, and once a minute while she is actually using
 *    the tab; the server stamps profiles.last_seen_at (at most once per 30s).
 *  - "מחוברת עכשיו" = stamped within the last ONLINE_MINUTES. No websockets,
 *    no Supabase Realtime: NetFree blocks those for part of the community, a
 *    plain HTTPS ping passes everywhere, and one small write per active member
 *    per minute is nothing at thousands of members.
 *  - readers just compare the stamp to now - lists that already refresh
 *    (the chat's AutoRefresh) show the change by themselves.
 */
export const ONLINE_MINUTES = 5;
export const HEARTBEAT_SECONDS = 60;
/** The heartbeat stops after this much time with no interaction - an open, forgotten tab is not "online". */
export const HEARTBEAT_IDLE_STOP_SECONDS = 120;

export interface Presence {
  online: boolean;
  /** Short: "מחוברת עכשיו" / "נראתה לפני 12 דק׳" / "עוד לא נכנסה". */
  label: string;
  /** For a tooltip: the state and the exact last-seen phrase. */
  title: string;
}

const DAY = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", timeZone: "Asia/Jerusalem" });

export function isOnline(lastSeen: string | null | undefined, now = Date.now()): boolean {
  if (!lastSeen) return false;
  return now - new Date(lastSeen).getTime() < ONLINE_MINUTES * 60_000;
}

export function lastSeenPhrase(lastSeen: string | null | undefined, now = Date.now()): string {
  if (!lastSeen) return "עוד לא נכנסה";
  const diff = Math.max(0, now - new Date(lastSeen).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "נראתה לפני רגע";
  if (min < 60) return `נראתה לפני ${min} דק׳`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `נראתה לפני ${hours === 1 ? "שעה" : `${hours} שעות`}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "נראתה אתמול";
  if (days < 7) return `נראתה לפני ${days} ימים`;
  return `נראתה ב-${DAY.format(new Date(lastSeen))}`;
}

export function presenceOf(lastSeen: string | null | undefined, now = Date.now()): Presence {
  if (isOnline(lastSeen, now)) {
    return { online: true, label: "מחוברת עכשיו", title: `מחוברת עכשיו · פעילה ב-${ONLINE_MINUTES} הדקות האחרונות` };
  }
  const phrase = lastSeenPhrase(lastSeen, now);
  return { online: false, label: phrase, title: `לא מחוברת · ${phrase}` };
}
