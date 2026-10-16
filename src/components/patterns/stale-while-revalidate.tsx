"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSnapshots, readSnapshot, setViewer, writeSnapshot } from "@/lib/snapshot-store";

/**
 * Stale-while-revalidate for the whole site and admin (the owner, 16/10):
 *
 *  1. A page she already visited comes straight from the router cache
 *     (next.config staleTimes). <RevalidateStale> - rendered by each route
 *     group's template.tsx, so it mounts on every navigation - checks when
 *     this path was last actually fetched from the server; a cached replay
 *     has no recent fetch, so it refreshes in the background and shows the
 *     ״מתעדכן…״ pill until the fresh render swaps in.
 *  2. While a route still loads, she sees the last snapshot of it: on a
 *     click, <SnapshotCapture> swaps the current page for the destination's
 *     snapshot (dimmed, inert, with the pill) until the navigation commits -
 *     Next 16 keeps the old page on screen during a navigation, so without
 *     this a slow page reads as "nothing happened". Cold loads get the same
 *     preview from every loading.tsx (<SnapshotLoading>). Each settled
 *     render is stored for next time.
 */

/* ---------- when was each path last fetched from the server ---------- */

const fetchedAt = new Map<string, number>();
let observing = false;
function noteEntry(e: PerformanceEntry) {
  if (!e.name.includes("_rsc=")) return;
  try {
    const u = new URL(e.name);
    const end = performance.timeOrigin + (e as PerformanceResourceTiming).responseEnd;
    if ((fetchedAt.get(u.pathname) ?? 0) < end) fetchedAt.set(u.pathname, end);
  } catch {}
}
function startObserving() {
  if (observing || typeof PerformanceObserver === "undefined") return;
  observing = true;
  try {
    performance.setResourceTimingBufferSize(1500);
    performance.addEventListener("resourcetimingbufferfull", () => performance.clearResourceTimings());
    const po = new PerformanceObserver((list) => list.getEntries().forEach(noteEntry));
    po.observe({ type: "resource", buffered: true });
  } catch {}
}
/** The observer delivers asynchronously; the sync buffer has what just finished. */
function lastFetch(path: string): number {
  try {
    performance.getEntriesByType("resource").forEach(noteEntry);
  } catch {}
  return fetchedAt.get(path) ?? 0;
}
/** A fetch younger than this is the navigation that just brought the page - nothing to refresh. */
const FRESH_MS = 2500;
let firstMount = true;

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
 * Mounts on every navigation (template.tsx). The document itself is fresh
 * on the first mount; afterwards, a path with no server fetch in the last
 * 2.5s was replayed from the router cache - refresh it in the background.
 */
export function RevalidateStale() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  useEffect(() => {
    startObserving();
    if (firstMount) {
      firstMount = false;
      return;
    }
    if (Date.now() - lastFetch(pathname) < FRESH_MS) return;
    start(() => router.refresh());
  }, [pathname, router]);
  return pending ? <UpdatingPill /> : null;
}

/* ---------- snapshots: capture, click preview ---------- */

interface Preview {
  path: string;
  html: string | null;
  /** The route she clicked from - once the pathname moves on, the preview is over. */
  from: string;
}

/**
 * Wraps the route (template.tsx): keeps the last settled render for next
 * time, and on an in-app link click shows the destination's last snapshot
 * in place of the current page until the navigation commits.
 */
export function SnapshotCapture({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [preview, setPreview] = useState<Preview | null>(null);

  // capture the settled render of this route
  useEffect(() => {
    let done = false;
    const capture = () => {
      const el = ref.current;
      if (!el || done) return;
      // still a loading state (spinner, skeleton or an older snapshot) - not worth keeping
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

  // a click on an in-app link = a navigation starts: show where she is going
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      const html = readSnapshot(url.pathname)?.html ?? null;
      if (timer) clearTimeout(timer);
      // a cached destination commits at once - no need to flash a preview for it
      const from = location.pathname;
      timer = setTimeout(() => setPreview({ path: url.pathname, html, from }), 150);
    };
    const onPop = () => {
      if (timer) clearTimeout(timer);
      setPreview(null);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // a navigation that goes nowhere (modal link, aborted): give the page back after a while
  useEffect(() => {
    if (!preview) return;
    const t = setTimeout(() => setPreview(null), 12000);
    return () => clearTimeout(t);
  }, [preview]);

  // the navigation committed (new pathname) = the preview is over; the template remounts anyway
  const active = preview && preview.from === pathname ? preview : null;
  const showing = !!active?.html;
  return (
    <>
      {active &&
        (active.html ? (
          <div data-nav-preview={active.path} aria-busy="true" className="relative">
            <div data-snapshot-html className="pointer-events-none select-none opacity-75" dangerouslySetInnerHTML={{ __html: active.html }} />
            <UpdatingPill label="מציגה את מה שראית לאחרונה · מתעדכן…" />
          </div>
        ) : (
          <UpdatingPill label="טוענת…" />
        ))}
      <div ref={ref} data-snapshot-root className={showing ? "hidden" : "contents"}>
        {children}
      </div>
    </>
  );
}

const subscribeNoop = () => () => {};

/**
 * The loading boundary (every loading.tsx): the last snapshot of this route
 * when there is one (dimmed, inert, with the pill), otherwise the skeleton
 * the route had. Server render and first client render both return the
 * skeleton, so there is nothing to mismatch.
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
