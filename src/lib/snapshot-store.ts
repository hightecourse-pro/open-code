/**
 * Route snapshots in HER browser (the owner, 16/10: "לשמור רשימות ארוכות בקש
 * בדפדפן ולהציג מיד"). What a route last rendered is kept in localStorage,
 * per viewer and per build, so the next visit paints it instantly while the
 * fresh render streams in. Client-only; every call is try/catch'd because
 * storage can be full, blocked or private.
 *
 * Privacy: the snapshots are the pages she herself saw, in her own browser,
 * keyed by her id - and wiped the moment the login page shows or another
 * member signs in on the same browser.
 */
const PREFIX = "oc-snap:";
const VIEWER_KEY = "oc-snap-viewer";
const INDEX_KEY = "oc-snap-index";
/** Bigger pages are not snapshotted (UTF-16 chars; ~1.2MB). The router cache still covers them. */
export const MAX_CHARS = 600_000;
const MAX_ENTRIES = 10;
export const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

export interface SnapshotEntry {
  html: string;
  at: number;
  build: string;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
function index(): string[] {
  return safe(() => JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]") as string[], []);
}
function saveIndex(keys: string[]) {
  safe(() => localStorage.setItem(INDEX_KEY, JSON.stringify(keys)), undefined);
}

export function currentViewer(): string | null {
  return safe(() => localStorage.getItem(VIEWER_KEY), null);
}

/** Called by the shells with the signed-in member's id: another viewer = a clean slate. */
export function setViewer(id: string) {
  if (currentViewer() === id) return;
  clearSnapshots();
  safe(() => localStorage.setItem(VIEWER_KEY, id), undefined);
}

export function clearSnapshots() {
  safe(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
    localStorage.removeItem(INDEX_KEY);
    localStorage.removeItem(VIEWER_KEY);
  }, undefined);
}

function keyFor(path: string): string | null {
  const v = currentViewer();
  return v ? `${PREFIX}${v}:${path}` : null;
}

let last: { key: string; entry: SnapshotEntry | null } | null = null;

/** Memoised per key so a store subscriber gets a stable value back. */
export function readSnapshot(path: string): SnapshotEntry | null {
  const k = keyFor(path);
  if (!k) return null;
  if (last && last.key === k) return last.entry;
  const entry = safe(() => JSON.parse(localStorage.getItem(k) ?? "null") as SnapshotEntry | null, null);
  const valid = entry && entry.build === BUILD && typeof entry.html === "string" ? entry : null;
  last = { key: k, entry: valid };
  return valid;
}

export function writeSnapshot(path: string, html: string) {
  const k = keyFor(path);
  if (!k || html.length > MAX_CHARS || html.length < 200) return;
  const entry: SnapshotEntry = { html, at: Date.now(), build: BUILD };
  let keys = index().filter((x) => x !== k);
  keys.push(k);
  while (keys.length > MAX_ENTRIES) {
    const old = keys.shift()!;
    safe(() => localStorage.removeItem(old), undefined);
  }
  const body = JSON.stringify(entry);
  let ok = safe(() => {
    localStorage.setItem(k, body);
    return true;
  }, false);
  if (!ok) {
    // quota: drop the older half and try once more
    const drop = keys.slice(0, Math.ceil(keys.length / 2)).filter((x) => x !== k);
    for (const old of drop) safe(() => localStorage.removeItem(old), undefined);
    keys = keys.filter((x) => !drop.includes(x));
    ok = safe(() => {
      localStorage.setItem(k, body);
      return true;
    }, false);
  }
  if (ok) {
    last = { key: k, entry };
    saveIndex(keys);
  }
}
