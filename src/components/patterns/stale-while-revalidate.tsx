"use client";

import { useEffect, useRef, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSnapshots, readSnapshot, setViewer, writeSnapshot } from "@/lib/snapshot-store";

/**
 * Stale-while-revalidate for the whole site and admin (the owner, 16/10):
 *
 *  1. A page she already visited comes straight from the router cache
 *     (next.config staleTimes), and <RevalidateStale> - rendered by each
 *     route group's template.tsx with a fresh nonce per server render -
 *     notices the replayed nonce, refreshes in the background and shows the
 *     ״מתעדכן…״ pill until the new render swaps in.
 *  2. A route that still has to load shows the last snapshot of what she
 *     saw there (<SnapshotLoading>, used by every loading.tsx), dimmed and
 *     inert, with the same pill - and <SnapshotCapture> (the templates)
 *     stores each settled render for next time.
 */

const seen = new Map<string, number>();

/** The shells tell the store who is signed in; a different member wipes the previous one's snapshots. */
export function ViewerMarker({ id }: { id: string }) {
  useEffect(() => setViewer(id), [id]);
  return null;
}

/** The login page: whoever is here is signed out - nothing of the last viewer stays behind. */
export function ClearSnapshots() {
  useEffect(() => clearSnapshots(), []);
  return null;
}

/** The small fixed pill while a fresh render is on its way. */
export function UpdatingPill({ label = "מתעדכן…" }: { label?: string }) {
  return (
    <div data-updating className="fixed bottom-4 inset-x-0 z-40 flex justify-center pointer-events-none">
      <span className="inline-flex items-center gap-2 rounded-full bg-ink-900/90 text-white text-[12.5px] font-semibold px-3.5 py-1.5 shadow-lg">
        <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />
        {label}
      </span>
    </div>
  );
}

/**
 * A nonce the server minted for this render. Seeing the same nonce mounted
 * again means the page was replayed from the router cache - refresh it in
 * the background. (The 2s grace keeps dev's double-mount from counting.)
 */
export function RevalidateStale({ nonce }: { nonce: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    const first = seen.get(nonce);
    if (first === undefined) {
      seen.set(nonce, Date.now());
      return;
    }
    if (Date.now() - first < 2000) return;
    start(() => router.refresh());
  }, [nonce, router]);
  return pending ? <UpdatingPill /> : null;
}

/** Keeps the last settled render of the route for the next visit's instant preview. */
export function SnapshotCapture({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    let done = false;
    const capture = () => {
      const el = ref.current;
      if (!el || done) return;
      // still the loading state (spinner, skeleton or an older snapshot) - not worth keeping
      if (el.querySelector("[data-snapshot-loading]")) return;
      if (!(el.textContent ?? "").trim()) return;
      writeSnapshot(pathname, el.innerHTML);
      done = true;
    };
    const timers = [1200, 3000, 7000].map((ms) => setTimeout(capture, ms));
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        done = false;
        capture();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [pathname]);
  return (
    <div ref={ref} data-snapshot-root className="contents">
      {children}
    </div>
  );
}

const subscribeNoop = () => () => {};

/**
 * The loading boundary: the last snapshot of this route when there is one
 * (dimmed, inert, with the pill), otherwise the skeleton the route had.
 * Server render and first client render both return the skeleton, so there
 * is nothing to mismatch.
 */
export function SnapshotLoading({ fallback }: { fallback: ReactNode }) {
  const pathname = usePathname();
  const html = useSyncExternalStore(
    subscribeNoop,
    () => readSnapshot(pathname)?.html ?? null,
    () => null
  );
  if (!html) return <div data-snapshot-loading>{fallback}</div>;
  return (
    <div data-snapshot-loading aria-busy="true" className="relative">
      <div data-snapshot-html className="pointer-events-none select-none opacity-75" dangerouslySetInnerHTML={{ __html: html }} />
      <UpdatingPill label="מציגה את מה שראית לאחרונה · מתעדכן…" />
    </div>
  );
}
