"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSnapshots, readSnapshot, setViewer, writeSnapshot } from "@/lib/snapshot-store";

/**
 * Stale-while-revalidate for the whole site and admin (the owner, 16/10):
 *
 *  1. A page she already visited comes straight from the router cache
 *     (next.config staleTimes). <RevalidateStale> - rendered by each route
 *     group's template.tsx, so it mounts on every navigation - watches the
 *     router's own page fetches; a cached replay has none in flight or
 *     recent, so it refreshes in the background and shows the ״מתעדכן…״
 *     pill until the fresh render swaps in.
 *  2. While a route still loads, she sees the last snapshot of it: on a
 *     click, <SnapshotCapture> swaps the current page for the destination's
 *     snapshot (dimmed, inert, with the pill) until the navigation commits -
 *     Next 16 keeps the old page on screen during a navigation, so without
 *     this a slow page reads as "nothing happened". Cold loads get the same
 *     preview from every loading.tsx (<SnapshotLoading>). Each settled
 *     render is stored for next time.
 */

/* ---------- which paths are being fetched from the server right now ---------- */

const inFlight = new Map<string, number>();
const endedAt = new Map<string, number>();
let patched = false;
/**
 * The router fetches a page with `RSC: 1` (prefetches add `Next-Router-Prefetch`).
 * Knowing when such a fetch started and ended is the only reliable way to tell
 * "this page just came from the server" from "this page was replayed from the
 * cache" - the performance timeline only lists a fetch once its stream closed,
 * which is after React already committed the page.
 */
function watchNavigationFetches() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const native = window.fetch.bind(window);
  window.fetch = (input, init) => {
    let path: string | null = null;
    try {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (headers.get("RSC") === "1" && !headers.get("Next-Router-Prefetch")) {
        path = new URL(input instanceof Request ? input.url : String(input), location.href).pathname;
      }
    } catch {}
    if (!path) return native(input, init);
    const p = path;
    inFlight.set(p, (inFlight.get(p) ?? 0) + 1);
    const done = () => {
      const n = (inFlight.get(p) ?? 1) - 1;
      if (n <= 0) inFlight.delete(p);
      else inFlight.set(p, n);
      endedAt.set(p, Date.now());
    };
    return native(input, init).then(
      (res) => {
        // the body streams on after the headers - count it as in flight until it closes
        if (res.body) {
          const [a, b] = res.body.tee();
          new Response(b).arrayBuffer().then(done, done);
          return new Response(a, { status: res.status, statusText: res.statusText, headers: res.headers });
        }
        done();
        return res;
      },
      (err) => {
        done();
        throw err;
      }
    );
  };
}
/** A fetch that is still streaming, or closed within this window, is the navigation that just brought the page. */
const FRESH_MS = 2500;
function justFetched(path: string): boolean {
  return inFlight.has(path) || Date.now() - (endedAt.get(path) ?? 0) < FRESH_MS;
}
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
 * on the first mount; afterwards, a path whose page is neither being fetched
 * nor was fetched in the last 2.5s was replayed from the router cache -
 * refresh it in the background.
 */
export function RevalidateStale() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  useEffect(() => {
    watchNavigationFetches();
    if (firstMount) {
      firstMount = false;
      return;
    }
    if (justFetched(pathname)) return;
    // the route's loading boundary is up = its page is on the way right now
    if (document.querySelector("[data-snapshot-root] [data-snapshot-loading]")) return;
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
          <div data-nav-preview={active.path} aria-busy="true" className="relative min-w-0 max-w-full overflow-hidden">
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
    <div data-snapshot-loading aria-busy="true" className="relative min-w-0 max-w-full overflow-hidden">
      <div data-snapshot-html className="pointer-events-none select-none opacity-75" dangerouslySetInnerHTML={{ __html: html }} />
      <UpdatingPill label="מציגה את מה שראית לאחרונה · מתעדכן…" />
    </div>
  );
}
