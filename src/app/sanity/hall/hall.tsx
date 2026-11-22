"use client";

import { useEffect, useRef } from "react";
import { useHallView } from "@/lib/sanity/client";
import type { HallView } from "@/lib/sanity/shared";
import { HallApp } from "./hall-app";
import "./hall.css";

/*
  The hall screen: React mounts the stage and feeds it the live view (polled
  every two seconds); HallApp draws - the kit's hall.js, ported. The page is a
  1920×1080 stage scaled to whatever screen shows it; F = full screen, ← = the
  next scene, R = the reveal's intro, Esc = back to the live picture.
*/
export function Hall({ initial, slug, lockedScene }: { initial: HallView; slug: string | null; lockedScene: string | null }) {
  const { view, online, offset } = useHallView(initial, slug, 2000);
  const stageRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HallApp | null>(null);
  const gender = initial.event?.gender ?? "m";

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const app = new HallApp(el, { slug, lockedScene, gender });
    appRef.current = app;
    (window as unknown as { HALL?: unknown }).HALL = { show: (id: Parameters<HallApp["showScene"]>[0]) => app.showScene(id), nextScene: () => app.nextScene(), reveal: () => app.showReveal(), hide: () => app.hideReveal() };
    return () => {
      app.destroy();
      appRef.current = null;
    };
  }, [slug, lockedScene, gender]);

  useEffect(() => {
    appRef.current?.update(view, offset);
  }, [view, offset]);

  return (
    <div className="hk-hall hk-page" data-testid="hall" data-online={online ? "1" : "0"} data-event={view.event?.slug ?? ""}>
      <div className="viewport">
        <div className="stage hall" ref={stageRef} />
        {!online ? <div className="hk-offline" role="status">החיבור לשרת נקטע. המסך מציג את התמונה האחרונה.</div> : null}
      </div>
    </div>
  );
}
