/**
 * Visits - the four doors the owner asked to count (11/10) plus the two side
 * doors, and how a path maps onto them. Shared by the beacon route and the
 * admin screen; no server imports.
 */
export type VisitArea = "site" | "community" | "hackathon" | "course" | "portal" | "coordinator";

// Four fixed categorical hues (validated 11/10 with the dataviz palette
// checker: lightness, chroma, colour-blind and normal-vision separation all
// pass). The two side doors are greys - they never sit in the chart.
export const VISIT_AREAS: { key: VisitArea; label: string; hint: string; color: string }[] = [
  { key: "site", label: "האתר הציבורי", hint: "דף הבית, הצטרפות, התחברות, פרטיות", color: "#7C3AED" },
  { key: "community", label: "הקהילה", hint: "כל המסכים אחרי התחברות", color: "#E0418D" },
  { key: "hackathon", label: "דף ההאקתון", hint: "/hackathon-2026 ושותפים", color: "#0891B2" },
  { key: "course", label: "דף הקורס", hint: "/masters-course, הרשמה, תודה", color: "#CA8A04" },
  { key: "portal", label: "פורטל מעסיקים", hint: "/portal", color: "#6B7280" },
  { key: "coordinator", label: "רכזות מוסדות", hint: "/coordinator", color: "#9CA3AF" },
];

const COMMUNITY_ROOTS = new Set([
  "ai", "articles", "chat", "content", "courses", "cv", "events", "feed", "forum", "hackathon", "jobs", "members", "mentor",
  "profile", "recordings", "requests", "session-feedback", "subscription",
]);

/** Which door a path belongs to. Admin and API paths are never recorded (the caller drops them). */
export function visitAreaOf(path: string): VisitArea {
  if (/^\/hackathon-2026(\/|$)/.test(path) || path === "/partners") return "hackathon";
  if (/^\/masters-course(\/|$)/.test(path)) return "course";
  if (/^\/portal(\/|$)/.test(path)) return "portal";
  if (/^\/coordinator(\/|$)/.test(path)) return "coordinator";
  const first = path.split("/")[1] ?? "";
  if (COMMUNITY_ROOTS.has(first)) return "community";
  return "site";
}

/** A clean pathname or null: no query, no hash, no admin/api, bounded length. */
export function normalizeVisitPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let p = raw.trim();
  if (!p.startsWith("/")) return null;
  p = p.split(/[?#]/)[0].replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  if (p.length > 200) return null;
  if (/^\/(admin|api|_next|dev)(\/|$)/.test(p)) return null;
  return p || "/";
}

/** Crawlers, previews and our own headless checks never count. */
export const BOT_UA_RE =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pagespeed|vercel-screenshot|python-requests|curl\/|wget\/|axios\/|node-fetch|go-http-client|java\/|okhttp/i;

export function deviceOf(ua: string): "mobile" | "desktop" {
  return /mobile|android|iphone|ipad|ipod/i.test(ua) ? "mobile" : "desktop";
}

export type VisitRange = "today" | "7d" | "30d" | "90d" | "all";

export const VISIT_RANGES: { key: VisitRange; label: string }[] = [
  { key: "today", label: "היום" },
  { key: "7d", label: "7 ימים" },
  { key: "30d", label: "30 ימים" },
  { key: "90d", label: "90 ימים" },
  { key: "all", label: "מאז ההתחלה" },
];

/** [from, to) for a range, in Israel days: "today" starts at local midnight, "7d" = today + 6 days back. */
export function visitWindow(range: VisitRange, now = new Date()): { from: Date; to: Date } {
  const to = new Date(now.getTime() + 60 * 1000);
  if (range === "all") return { from: new Date("2026-01-01T00:00:00Z"), to };
  const israelMidnight = startOfIsraelDay(now);
  const days = range === "today" ? 0 : range === "7d" ? 6 : range === "30d" ? 29 : 89;
  return { from: new Date(israelMidnight.getTime() - days * 86400000), to };
}

function startOfIsraelDay(d: Date): Date {
  // The date in Israel, then that date's midnight expressed in UTC (DST-aware via the offset of that instant).
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const [y, m, day] = parts.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, day, 0, 0, 0);
  // Offset of Israel at that moment (+2 or +3 hours).
  const offsetMin = israelOffsetMinutes(new Date(guess));
  return new Date(guess - offsetMin * 60000);
}

function israelOffsetMinutes(at: Date): number {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  return Math.round((local - at.getTime()) / 60000);
}
