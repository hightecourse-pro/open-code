"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Minus } from "lucide-react";
import { markHiresSeen } from "@/app/(app)/hired-banner-actions";

export interface HiredMember {
  /** The hires-registry row - what "seen" is tracked by. */
  id: string;
  full_name: string;
  /** Her member card, when she's in the community - the name links to it. */
  profileId?: string | null;
}

/**
 * Festive congratulations for women who recently started a new job
 * (members with found_job + hired_at, and off-community placements - both
 * within the celebration window). Names only - a member's workplace is never
 * shown to other members.
 *
 * Floats app-wide (the PM: not buried in the forum), bottom-start so it never
 * fights the request widget in the other corner.
 *
 * Per member, not per browser (the owner, 18/9): it opens by itself ONLY when
 * there is news she has not seen yet; unseen names carry a "חדש" mark; once
 * she has looked (the open banner, a few seconds), the names are recorded as
 * seen - the mark drops and the banner stays a 🎉 chip until the next hire.
 */
export function HiredBanner({ members, seenIds }: { members: HiredMember[]; seenIds: string[] }) {
  const seen = new Set(seenIds);
  const unseen = members.filter((m) => !seen.has(m.id));
  const hasNews = unseen.length > 0;
  const newsKey = unseen
    .map((m) => m.id)
    .sort()
    .join(",");

  // Her minimize choice for THIS batch of news sticks per browser - a new
  // hire changes the key and the banner opens again.
  const storageKey = `hired-banner-min:${newsKey || "none"}`;
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    return () => window.removeEventListener("storage", cb);
  }, []);
  const storedMin = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey) === "1";
      } catch {
        return false;
      }
    },
    () => true
  );
  const [override, setOverride] = useState<boolean | null>(null);
  // No news → stays a chip until she opens it herself.
  const minimized = override ?? (hasNews ? storedMin : true);

  // Unseen names first, then the rest, gently rotating (the owner, 2/9).
  const ordered = [...unseen, ...members.filter((m) => seen.has(m.id))];
  const [nameIdx, setNameIdx] = useState(0);
  const many = ordered.length > 1;
  useEffect(() => {
    if (!many || minimized) return;
    const id = setInterval(() => setNameIdx((i) => (i + 1) % ordered.length), 3500);
    return () => clearInterval(id);
  }, [many, minimized, ordered.length]);

  // Looking at the open banner for a few seconds = seen. Recorded once per
  // batch; the marks drop on her next page load, not mid-look.
  useEffect(() => {
    if (!hasNews || minimized) return;
    const ids = unseen.map((m) => m.id);
    const t = setTimeout(() => {
      void markHiresSeen(ids);
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNews, minimized, newsKey]);

  if (members.length === 0) return null;
  const current = ordered[nameIdx % ordered.length];
  const currentIsNew = !seen.has(current.id);

  function toggle(next: boolean) {
    setOverride(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* private mode - the choice just won't stick */
    }
  }

  return (
    <div className="fixed bottom-4 start-4 z-40" dir="rtl">
      {minimized ? (
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label="חברות שהתקבלו לעבודה - להרחבה"
          title={hasNews ? "יש חדשות משמחות 🎉" : "החברות שהתקבלו לעבודה 🎉"}
          className="relative w-11 h-11 rounded-full bg-brand-gradient text-white text-[20px] shadow-glow-pink flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
        >
          🎉
          {hasNews && (
            <span className="absolute -top-1 -end-1 bg-white text-brand-pink-deep text-[10px] font-black px-1.5 py-px rounded-full shadow">
              חדש
            </span>
          )}
        </button>
      ) : (
        <div className="bg-brand-gradient text-white rounded-[18px] p-4 pe-3 shadow-glow-pink max-w-[340px]">
          <div className="flex items-start gap-2.5">
            <span className="text-[22px] leading-none" aria-hidden>
              🎉
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="font-display font-black text-[15px]">
                מזל טוב לחברות שלנו שמתחילות עבודה :)
              </div>
              {/* Name enlarged, and no i/N counter - how many were hired is
                  the team's business, not the banner's (the owner, 3/9). */}
              <div
                key={current.id}
                className="text-[17px] font-display font-black animate-[hired-swap_.5s_ease] flex items-center gap-1.5 flex-wrap"
              >
                🎊{" "}
                {current.profileId ? (
                  <Link href={`/members/${current.profileId}`} className="text-white underline decoration-white/70 hover:opacity-80">
                    {current.full_name}
                  </Link>
                ) : (
                  current.full_name
                )}{" "}
                🎊
                {currentIsNew && (
                  <span className="bg-white text-brand-pink-deep text-[10.5px] font-black px-2 py-px rounded-full shadow-sm">
                    חדש
                  </span>
                )}
              </div>
              <style>{`@keyframes hired-swap { from { opacity: 0; translate: 0 6px } to { opacity: 1; translate: 0 0 } }`}</style>
              <div className="text-[12px] opacity-85">
                כל הקהילה מאחלת חגיגית - שתהיה הצלחה ענקית 💜
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggle(true)}
              aria-label="הקטנה"
              className="shrink-0 w-6 h-6 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Minus size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
