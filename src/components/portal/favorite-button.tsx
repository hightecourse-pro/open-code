"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleFavorite } from "@/app/portal/favorite-actions";

/** A heart/star toggle that adds a candidate to the client's favorites. */
export function FavoriteButton({
  profileId,
  initial,
  size = "md",
}: {
  profileId: string;
  initial: boolean;
  size?: "sm" | "md";
}) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "הסרה מהמועדפות" : "הוספה למועדפות"}
      title={on ? "במועדפות" : "הוספה למועדפות"}
      disabled={pending}
      onClick={(e) => {
        // Cards are wrapped in a link — don't navigate when favoriting.
        e.preventDefault();
        e.stopPropagation();
        const next = !on;
        setOn(next);
        start(async () => {
          const res = await toggleFavorite(profileId, next);
          if (!res.ok) setOn(!next); // revert on failure
          else setOn(res.on);
        });
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full border transition-colors disabled:opacity-60",
        size === "sm" ? "h-7 w-7" : "h-9 w-9",
        on
          ? "bg-[#FBF3E2] border-[#F0DCA8] text-[#C9962B]"
          : "bg-ink-0 border-ink-200 text-ink-400 hover:border-[#F0DCA8] hover:text-[#C9962B]"
      )}
    >
      <Star size={size === "sm" ? 14 : 16} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
