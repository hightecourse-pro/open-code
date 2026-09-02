"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Minus } from "lucide-react";

export interface HiredMember {
  full_name: string;
  /** Her member card, when she's in the community — the name links to it. */
  profileId?: string | null;
}

/**
 * Festive congratulations for women who recently started a new job
 * (members with found_job + hired_at, and off-community placements — both
 * within the celebration window). Names only — a member's workplace is never
 * shown to other members.
 *
 * Floats app-wide (the PM: not buried in the forum), bottom-start so it never
 * fights the request widget in the other corner. Minimizable to a 🎉 chip —
 * the choice sticks per browser until the set of names changes, so a NEW
 * celebration re-opens it.
 */
export function HiredBanner({ members }: { members: HiredMember[] }) {
  // FULL names, by the owner's explicit call (31/8: "השמות מלאים כמובן") —
  // and because the storage key below is derived from this exact string,
  // every newly hired member changes it and the banner re-opens for everyone.
  const names = members
    .map((m) => m.full_name.trim())
    .filter(Boolean)
    .join(", ");

  const storageKey = `hired-banner-min:${names}`;
  // localStorage through useSyncExternalStore: the server snapshot says
  // "minimized", the client snapshot reads the real choice, and React
  // reconciles after hydration — no setState-in-effect cascade.
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
  // Her click this session wins over what storage said at load.
  const [override, setOverride] = useState<boolean | null>(null);
  const minimized = override ?? storedMin;

  // One name at a time, gently rotating (the owner, 2/9: "אנימציה שהשמות
  // מתחלפים") — only when there is actually more than one to rotate.
  const [nameIdx, setNameIdx] = useState(0);
  const many = members.length > 1;
  useEffect(() => {
    if (!many || minimized) return;
    const id = setInterval(() => setNameIdx((i) => (i + 1) % members.length), 3500);
    return () => clearInterval(id);
  }, [many, minimized, members.length]);

  if (members.length === 0) return null;
  const current = members[nameIdx % members.length];

  function toggle(next: boolean) {
    setOverride(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      /* private mode — the choice just won't stick */
    }
  }

  return (
    <div className="fixed bottom-4 start-4 z-40" dir="rtl">
      {minimized ? (
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label="חברות שהתקבלו לעבודה — להרחבה"
          title="יש חדשות משמחות 🎉"
          className="w-11 h-11 rounded-full bg-brand-gradient text-white text-[20px] shadow-glow-pink flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
        >
          🎉
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
              {/* Name enlarged, and no i/N counter — how many were hired is
                  the team's business, not the banner's (the owner, 3/9). */}
              <div
                key={current.full_name}
                className="text-[17px] font-display font-black animate-[hired-swap_.5s_ease]"
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
              </div>
              <style>{`@keyframes hired-swap { from { opacity: 0; translate: 0 6px } to { opacity: 1; translate: 0 0 } }`}</style>
              <div className="text-[12px] opacity-85">
                כל הקהילה מרימה איתן כוסית — שתהיה הצלחה ענקית 💜
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
