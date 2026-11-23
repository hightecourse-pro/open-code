// ============================================================================
// The tablet's line to the server: every change of the game is queued and
// posted (coalesced, ~500ms), the forest photo rides along once, a failed
// post is retried every 10s while the game goes on from localStorage, and a
// 409 (another device took the circle, or the studio reset the event) hands
// the caller the server's truth.
// ============================================================================
import type { GameState } from "@/lib/sanity/engine";
import type { TabletBootstrap, TabletSave, TabletSaveResult } from "@/lib/sanity/shared";

export interface SyncHandlers {
  /** The server refused our version: it holds a newer game (or none after a reset). */
  onStale: (state: GameState | null, version: number, resetAt: string | null) => void;
  onOnline: (online: boolean) => void;
}
export interface Sync {
  /** Queue the latest game; `photo` (a JPEG data URL) is kept until a post with it succeeds. */
  queue(payload: TabletSave, photo?: string | null): void;
  /** True while a post is pending or in flight - the caller avoids adopting a polled state mid-write. */
  busy(): boolean;
  fetchBoot(): Promise<TabletBootstrap | null>;
  destroy(): void;
}

const DEBOUNCE_MS = 500;
const RETRY_MS = 10_000;

export function createSync(token: string, h: SyncHandlers): Sync {
  const url = `/api/sanity/tablet/${token}`;
  let pending: TabletSave | null = null;
  let photo: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight = false;
  let alive = true;
  let online = true;

  const setOnline = (v: boolean) => {
    if (online !== v) {
      online = v;
      h.onOnline(v);
    }
  };
  const schedule = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, ms);
  };

  async function flush() {
    timer = null;
    if (!alive || inflight || !pending) return;
    const body: TabletSave = photo ? { ...pending, photo } : pending;
    const sentPhoto = photo;
    pending = null;
    inflight = true;
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => null)) as TabletSaveResult | null;
      if (r.status === 409 && j && !j.ok && "stale" in j) {
        setOnline(true);
        photo = null;
        pending = null;
        h.onStale(j.state, j.version, j.resetAt);
        return;
      }
      if (!r.ok) {
        // a 400 is our own mistake (logged, not retried forever); a 5xx is the server's - retry
        if (r.status >= 500) throw new Error(`server ${r.status}`);
        console.error("tablet save refused", j);
        setOnline(true);
        return;
      }
      setOnline(true);
      if (sentPhoto && photo === sentPhoto) photo = null;
    } catch {
      setOnline(false);
      // keep the newest game for the retry; the photo stays queued
      if (!pending) pending = body.photo ? { ...body, photo: undefined } : body;
      schedule(RETRY_MS);
    } finally {
      inflight = false;
      if (alive && pending && !timer) schedule(online ? DEBOUNCE_MS : RETRY_MS);
    }
  }

  return {
    queue(payload, p) {
      if (!alive) return;
      pending = payload;
      if (p) photo = p;
      schedule(DEBOUNCE_MS);
    },
    busy: () => inflight || !!pending,
    async fetchBoot() {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return null;
        setOnline(true);
        return (await r.json()) as TabletBootstrap;
      } catch {
        setOnline(false);
        return null;
      }
    },
    destroy() {
      alive = false;
      if (timer) clearTimeout(timer);
    },
  };
}
