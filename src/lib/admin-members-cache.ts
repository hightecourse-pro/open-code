import type { AdminMembersData } from "@/components/patterns/members-table";

/**
 * The last members list she received, kept in HER browser (15.11, the owner:
 * ״הייתי מצפה שיעבור מיד ויראה מה שיש לו בזכרון ויתעדכן ברקע בלי להפריע״).
 * The table paints it the moment she arrives and fetches the fresh list
 * behind it. Per viewer (another admin on the same browser never sees it),
 * in memory for this tab and in localStorage for the next one; every storage
 * call is try/catch'd - storage can be full, blocked or private, and then the
 * copy simply lives in memory only.
 */
const PREFIX = "oc-members:";
/** Bump when the row shape changes - an old copy is then ignored, not misread. */
const VERSION = 1;

let mem: { viewer: string; data: AdminMembersData } | null = null;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Memoised per viewer, so a store subscriber gets the same object back until a new list is written. */
export function readMembersCache(viewer: string): AdminMembersData | null {
  if (mem && mem.viewer === viewer) return mem.data;
  const parsed = safe(() => JSON.parse(localStorage.getItem(PREFIX + viewer) ?? "null") as { v?: number; data?: AdminMembersData } | null, null);
  if (!parsed || parsed.v !== VERSION || !parsed.data || !Array.isArray(parsed.data.members)) return null;
  mem = { viewer, data: parsed.data };
  return parsed.data;
}

export function writeMembersCache(viewer: string, data: AdminMembersData) {
  mem = { viewer, data };
  safe(() => {
    // one viewer per browser: a previous admin's copy goes
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX) && k !== PREFIX + viewer) localStorage.removeItem(k);
    }
    localStorage.setItem(PREFIX + viewer, JSON.stringify({ v: VERSION, data }));
  }, undefined);
}

/** The login page / a viewer change: nothing of the list stays behind. */
export function clearMembersCache() {
  mem = null;
  safe(() => {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  }, undefined);
}
