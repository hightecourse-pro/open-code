"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useHallView } from "@/lib/sanity/client";
import type { HallView } from "@/lib/sanity/shared";
import { HallApp } from "./hall-app";
import "./hall.css";

/*
  The hall screen: React mounts the stage and feeds it the live view (polled
  every two seconds); HallApp draws - the kit's hall.js, ported. Two stages:
  the kit's 1920×1080 (16:9) and - the venue's LED wall is 8 m × 2 m - a wide
  3840×960 one (4:1). `?wide=1` / `?wide=0` force one; otherwise the viewport's
  aspect decides (≥ 2.4:1 → wide), re-checked on resize. `?stretch=1` squashes
  the wide stage into whatever the screen is (a 16:9 laptop signal that the
  LED processor stretches back over the wall). F = full screen, ← = the next
  scene, R = the reveal's intro, S = the show (the whole ending as one screen; `?show=1` opens with its start
  button), Esc = back to the live picture.
*/
const WIDE_FROM = 2.4;
const onResize = (cb: () => void) => { addEventListener("resize", cb); return () => removeEventListener("resize", cb); };
const screenIsWide = () => innerWidth / innerHeight >= WIDE_FROM;
const serverGuess = () => false;

export function Hall({ initial, slug, lockedScene, forcedWide = null, stretch = false, show = false }: { initial: HallView; slug: string | null; lockedScene: string | null; forcedWide?: boolean | null; stretch?: boolean; show?: boolean }) {
  const { view, online, offset } = useHallView(initial, slug, 2000);
  const stageRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HallApp | null>(null);
  const latest = useRef({ view, offset });
  const gender = initial.event?.gender ?? "m";
  // the newest feed, for a stage that is rebuilt (the screen's shape changed) before the next poll
  useEffect(() => {
    latest.current = { view, offset };
  }, [view, offset]);
  // which stage: forced by the address, or by the screen's shape (re-checked on every resize)
  const autoWide = useSyncExternalStore(onResize, screenIsWide, serverGuess);
  const wide = forcedWide ?? autoWide;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const app = new HallApp(el, { slug, lockedScene, gender, wide, stretch, show });
    appRef.current = app;
    app.update(latest.current.view, latest.current.offset);
    (window as unknown as { HALL?: unknown }).HALL = { show: (id: Parameters<HallApp["showScene"]>[0]) => app.showScene(id), nextScene: () => app.nextScene(), reveal: () => app.showReveal(), hide: () => app.hideReveal(), start: () => app.startShow(), next: () => app.showNext(), back: () => app.showBack(), pause: () => app.showPause(), end: () => app.endShow(), wide };
    return () => {
      app.destroy();
      appRef.current = null;
    };
  }, [slug, lockedScene, gender, wide, stretch, show]);

  useEffect(() => {
    appRef.current?.update(view, offset);
  }, [view, offset]);

  return (
    <div className="hk-hall hk-page" data-testid="hall" data-online={online ? "1" : "0"} data-event={view.event?.slug ?? ""} data-layout={wide ? "wide" : "classic"} data-stretch={stretch ? "1" : "0"}>
      <div className="viewport">
        <div className={`stage hall${wide ? " wide" : ""}${stretch ? " stretch" : ""}`} ref={stageRef} />
        {!online ? <div className="hk-offline" role="status">החיבור לשרת נקטע. המסך מציג את התמונה האחרונה.</div> : null}
      </div>
    </div>
  );
}
