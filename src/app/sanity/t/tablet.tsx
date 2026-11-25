"use client";

import { useEffect, useRef } from "react";
import type { TabletBootstrap } from "@/lib/sanity/shared";
import { createTabletApp } from "./tablet-app";

/*
  The stage of the tablet, exactly the kit's tablet.html skeleton (the scoped
  stylesheet tablet.css addresses these ids and classes), mounted once;
  tablet-app.ts owns everything inside it from then on.
*/
const CLOUD = "M30 70 C10 70 6 44 26 40 C24 18 52 10 64 26 C72 4 112 4 118 30 C140 22 160 40 150 58 C166 62 162 80 146 80 L36 80 C28 80 26 72 30 70Z";

export function Tablet({ boot, token, edit = false }: { boot: TabletBootstrap; token: string; edit?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const qs = new URLSearchParams(location.search);
    const app = createTabletApp(host, { boot, token, dev: qs.has("dev"), shot: qs.has("shot"), edit });
    return () => app.destroy();
  }, [boot, token, edit]);

  // A real tablet, 90 minutes on the floor: the screen must not sleep, the
  // picture stays landscape, and a long press on an island never opens the
  // browser's save-image sheet. The wake lock is asked for on the first touch
  // (browsers want a gesture) and again whenever the page comes back.
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let lock: { release(): Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    // The conference's tablets (Lenovo TB-X505L, Chrome 81 - 25.11) have no Wake Lock API. The old trick still holds
    // the screen there: a small silent video playing in the page (Chrome keeps the screen on while a visible video
    // plays). Started on the first touch (a gesture is required) and restarted whenever the page comes back or is
    // touched again - the camera app of the forest photo pauses it.
    let video: HTMLVideoElement | null = null;
    const keepAwakeByVideo = () => {
      if (nav.wakeLock) return;
      if (!video) {
        video = document.createElement("video");
        video.src = "/sanity/keepawake.webm";
        video.loop = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("aria-hidden", "true");
        video.style.cssText = "position:fixed;left:0;bottom:0;width:160px;height:90px;opacity:0.02;pointer-events:none;z-index:0";
        host.appendChild(video);
      }
      if (video.paused) video.play().catch(() => {});
    };
    const grab = async () => {
      try {
        if (nav.wakeLock && document.visibilityState === "visible") lock = await nav.wakeLock.request("screen");
      } catch {
        /* an unsupported browser, or the page is hidden - nothing to hold */
      }
      if (document.visibilityState === "visible") keepAwakeByVideo();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") grab();
    };
    const onFirstTouch = () => {
      grab();
      const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      try {
        orientation.lock?.("landscape").catch(() => {});
      } catch {
        /* not fullscreen / not supported */
      }
    };
    const noMenu = (e: Event) => e.preventDefault();
    const onTouch = () => {
      if (video && video.paused) video.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    // pointerup: a touch's pointerdown carries no user activation in Chrome, and both the video and the wake lock need one
    window.addEventListener("pointerup", onFirstTouch, { once: true });
    window.addEventListener("pointerup", onTouch);
    host.addEventListener("contextmenu", noMenu);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerup", onFirstTouch);
      window.removeEventListener("pointerup", onTouch);
      host.removeEventListener("contextmenu", noMenu);
      lock?.release().catch(() => {});
      if (video) {
        video.pause();
        video.remove();
      }
    };
  }, []);
  return (
    <div className="hk-tablet hk-page" ref={ref} data-testid="tablet" data-circle={boot.circle}>
      <div id="wrap">
        <div id="stage">
          <div className="sky"></div>
          <div id="stars"></div>
          <div id="sun"></div>
          <div className="zbg"></div>
          <div id="motes"></div>
          <svg className="cloud" viewBox="0 0 170 90" width="180" style={{ position: "absolute", top: 110, right: 470 }} aria-hidden="true">
            <path d={CLOUD} />
          </svg>
          <svg className="cloud" viewBox="0 0 170 90" width="130" style={{ position: "absolute", top: 96, left: 40, opacity: 0.9, animationDuration: "34s" }} aria-hidden="true">
            <path d={CLOUD} />
          </svg>
          <svg className="cloud" viewBox="0 0 170 90" width="110" style={{ position: "absolute", top: 300, right: 30, opacity: 0.75, animationDuration: "22s" }} aria-hidden="true">
            <path d={CLOUD} />
          </svg>
          <div id="seaHost"></div>
          <div className="bar" id="bar"></div>
          <div id="board"></div>
          <div id="extra"></div>
          <div className="copy" id="copy"></div>
          <div id="fog">
            <span className="puff" style={{ left: -100, top: 100, width: 560, height: 400 }}></span>
            <span className="puff" style={{ left: 240, top: 260, width: 640, height: 440, animationDelay: "-2s" }}></span>
            <span className="puff" style={{ left: 40, top: -80, width: 520, height: 360, animationDelay: "-4s" }}></span>
            <span className="puff" style={{ left: 560, top: 40, width: 460, height: 340, animationDelay: "-1s" }}></span>
          </div>
          <div id="tide"></div>
          <div id="confetti"></div>
          <button className="go" id="go" type="button" hidden></button>
          <div id="syncpill" className="syncpill" hidden></div>
          <div id="toast" className="toast" hidden></div>
        </div>
      </div>
    </div>
  );
}
