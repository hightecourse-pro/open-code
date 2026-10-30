"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ⭐ ״לחזור אליה״ (the owner, 30/10): an admin marks a chat thread she has to
 * come back to. Rendered only for admins; the server action and its RPC enforce
 * that too. Optimistic - the star flips at once and rolls back if the save fails.
 */
export function ChatStar({
  conversationId,
  starred,
  action,
  size = 15,
  className,
}: {
  conversationId: string;
  starred: boolean;
  action: (conversationId: string, starred: boolean) => Promise<void>;
  size?: number;
  className?: string;
}) {
  const [on, setOn] = useState(starred);
  const [pending, start] = useTransition();
  const label = on ? "להסיר את הכוכב" : "לסמן: לחזור אליה";
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          try {
            await action(conversationId, next);
          } catch {
            setOn(!next);
          }
        });
      }}
      disabled={pending}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className={cn(
        "inline-flex items-center justify-center rounded-full p-1 transition-colors",
        on ? "text-[#E0A800] hover:text-[#B98700]" : "text-ink-300 hover:text-[#E0A800]",
        className
      )}
      data-testid="chat-star"
      data-on={on ? "1" : "0"}
    >
      <Star size={size} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
