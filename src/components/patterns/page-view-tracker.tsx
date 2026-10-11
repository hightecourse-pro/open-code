"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * One beacon per navigation to /api/track (the owner, 11/10: "כמה נכנסו").
 * Mounted once in the root layout; renders nothing. Admin and API paths are
 * skipped here and dropped again on the server. The search string is read
 * from window (not useSearchParams) so the root layout never bails out of
 * static rendering.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const last = useRef<{ path: string; at: number } | null>(null);

  useEffect(() => {
    if (!pathname || /^\/(admin|api)(\/|$)/.test(pathname)) return;
    const now = Date.now();
    if (last.current && last.current.path === pathname && now - last.current.at < 2000) return;
    last.current = { path: pathname, at: now };
    const payload = JSON.stringify({
      path: pathname,
      referrer: document.referrer || null,
      search: window.location.search || null,
    });
    try {
      fetch("/api/track", { method: "POST", body: payload, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    } catch {
      /* never disturb the page */
    }
  }, [pathname]);

  return null;
}
