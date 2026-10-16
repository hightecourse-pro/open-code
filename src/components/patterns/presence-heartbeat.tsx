"use client";

import { useEffect } from "react";
import { HEARTBEAT_IDLE_STOP_SECONDS, HEARTBEAT_SECONDS } from "@/lib/presence";

/**
 * The presence heartbeat (the owner, 16/10): one tiny POST on load, when the
 * tab comes back, and once a minute while she is actually using the tab. It
 * stops by itself after two idle minutes, so a forgotten tab goes orange.
 * Renders nothing. See src/lib/presence.ts for the why.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    let lastActive = Date.now();
    let lastSent = 0;
    const send = () => {
      if (Date.now() - lastSent < 20_000) return; // the server throttles too; this saves the request
      lastSent = Date.now();
      fetch("/api/presence", { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => {});
    };
    const markActive = () => {
      lastActive = Date.now();
    };
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActive > HEARTBEAT_IDLE_STOP_SECONDS * 1000) return;
      send();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        markActive();
        send();
      }
    };
    send();
    const id = setInterval(tick, HEARTBEAT_SECONDS * 1000);
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "scroll", "touchstart"];
    for (const e of events) window.addEventListener(e, markActive, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      for (const e of events) window.removeEventListener(e, markActive);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
