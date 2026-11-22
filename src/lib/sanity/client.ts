"use client";
// ============================================================================
// המסע לאי השפיות · the browser side of the feed: the hall screen and the
// studio poll /api/sanity/view; the studio posts its actions to
// /api/sanity/studio. Small, typed, shared.
// ============================================================================
import { useEffect, useRef, useState } from "react";
import type { HallView, StudioView } from "./shared";

export async function fetchHall(slug?: string | null): Promise<HallView> {
  const r = await fetch(`/api/sanity/view${slug ? `?event=${encodeURIComponent(slug)}` : ""}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`view ${r.status}`);
  return (await r.json()) as HallView;
}

/** The hall's feed, refreshed every `intervalMs`; `initial` paints the first frame without waiting. */
export function useHallView(initial: HallView, slug?: string | null, intervalMs = 2000): { view: HallView; online: boolean; offset: number } {
  const [view, setView] = useState<HallView>(initial);
  const [online, setOnline] = useState(true);
  const [offset, setOffset] = useState(() => (initial.now ? initial.now - Date.now() : 0));
  const busy = useRef(false);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const v = await fetchHall(slug);
        if (!alive) return;
        setView(v);
        setOffset(v.now - Date.now());
        setOnline(true);
      } catch {
        if (alive) setOnline(false);
      } finally {
        busy.current = false;
      }
    };
    const t = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [slug, intervalMs]);
  return { view, online, offset };
}

export type StudioResult = { ok: true; view: StudioView; [k: string]: unknown } | { ok: false; error: string };
export async function studioPost(body: Record<string, unknown>): Promise<StudioResult> {
  const r = await fetch("/api/sanity/studio", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => null)) as StudioResult | null;
  if (!j) return { ok: false, error: `השרת ענה ${r.status}` };
  return j;
}
export async function studioGet(): Promise<StudioView> {
  const r = await fetch("/api/sanity/studio", { cache: "no-store" });
  if (!r.ok) throw new Error(`studio ${r.status}`);
  return (await r.json()) as StudioView;
}
