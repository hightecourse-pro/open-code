"use client";

import { useSyncExternalStore, useCallback, useState } from "react";
import Link from "next/link";
import { GraduationCap, X } from "lucide-react";

const KEY = "oc:grades-nudge-dismissed";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The invitation to add a grade sheet (the owner, 19/9): a junior who
 * finished the questionnaire without one sees it on entry, until she adds a
 * sheet. The ✕ snoozes it for a week per browser — an invitation, not a nag.
 */
export function GradesNudge() {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    return () => window.removeEventListener("storage", cb);
  }, []);
  const snoozed = useSyncExternalStore(
    subscribe,
    () => {
      try {
        const until = Number(localStorage.getItem(KEY) ?? 0);
        return until > Date.now();
      } catch {
        return false;
      }
    },
    () => true
  );
  const [hidden, setHidden] = useState(false);
  if (snoozed || hidden) return null;

  return (
    <div className="flex items-center gap-2.5 bg-tint-indigo border border-[#C9CFF3] rounded-md p-3 px-4 mb-5 text-[13.5px] text-ink-900">
      <GraduationCap size={17} className="text-brand-indigo shrink-0" />
      <span className="flex-1">
        יש לך גליון ציונים? הוסיפי אותו לפרופיל — הוא עוזר לנו להציג אותך למעסיקים בצורה מלאה יותר 💜
      </span>
      <Link href="/cv#grades" className="font-display font-semibold whitespace-nowrap text-brand-indigo hover:underline">
        להוספת גליון ←
      </Link>
      <button
        type="button"
        aria-label="לא עכשיו"
        title="לא עכשיו"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(KEY, String(Date.now() + SNOOZE_MS));
          } catch {
            /* private mode — hides for this page only */
          }
        }}
        className="shrink-0 w-6 h-6 rounded-full hover:bg-white/60 flex items-center justify-center text-ink-500 cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>
  );
}
