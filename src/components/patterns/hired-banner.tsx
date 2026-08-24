"use client";

import { useEffect, useState } from "react";
import { Minus } from "lucide-react";

export interface HiredMember {
  full_name: string;
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
  // First names — a celebration between friends, not a roster of full names
  // broadcast to the whole community.
  const names = members
    .map((m) => m.full_name.trim().split(/\s+/)[0])
    .filter(Boolean)
    .join(", ");

  const storageKey = `hired-banner-min:${names}`;
  // Start minimized on both server and client render, then read the stored
  // choice in an effect — reading localStorage during render would make the
  // first client render disagree with the server one.
  const [minimized, setMinimized] = useState(true);
  useEffect(() => {
    try {
      setMinimized(localStorage.getItem(storageKey) === "1");
    } catch {
      setMinimized(false);
    }
  }, [storageKey]);

  if (members.length === 0) return null;

  function toggle(next: boolean) {
    setMinimized(next);
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
              <div className="text-[13px] font-semibold opacity-95">🎊 {names} 🎊</div>
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
