"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// A tab left open with no interaction stops polling after this long — at
// scale, every tick is a full server render, and idle tabs multiplied by
// concurrent members were the single biggest source of invocations. Any
// interaction (or returning to the tab) starts the clock again.
const IDLE_STOP_MS = 10 * 60 * 1000;

/**
 * Near-real-time without websockets: quietly re-fetch the server data every
 * few seconds while the tab is visible AND recently active. Client component
 * state (open forms, typed text) is preserved across refreshes.
 */
export function AutoRefresh({ seconds = 45 }: { seconds?: number }) {
  const router = useRouter();
  const lastActive = useRef(0);

  useEffect(() => {
    lastActive.current = Date.now();
    const markActive = () => {
      lastActive.current = Date.now();
    };
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastActive.current > IDLE_STOP_MS) return; // asleep
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        markActive(); // coming back wakes the polling up
        router.refresh();
      }
    };
    // ±20% jitter so a roomful of tabs doesn't tick in lockstep.
    const jittered = seconds * 1000 * (0.8 + Math.random() * 0.4);
    const id = setInterval(tick, jittered);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", markActive, { passive: true });
    window.addEventListener("keydown", markActive, { passive: true });
    window.addEventListener("scroll", markActive, { passive: true });
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("scroll", markActive);
    };
  }, [router, seconds]);

  return null;
}
