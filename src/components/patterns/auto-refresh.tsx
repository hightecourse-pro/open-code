"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Near-real-time without websockets: quietly re-fetch the server data every
 * few seconds while the tab is visible, so new posts/jobs from other members
 * appear without a manual refresh. Client component state (open forms, typed
 * text) is preserved across refreshes.
 */
export function AutoRefresh({ seconds = 25 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, seconds * 1000);
    // Also refresh when the member returns to the tab.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);

  return null;
}
