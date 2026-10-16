import type { ReactNode } from "react";
import { presenceOf } from "@/lib/presence";
import { cn } from "@/lib/utils";

type DotSize = "xs" | "sm" | "md" | "xl";
const DOT: Record<DotSize, string> = { xs: "h-2.5 w-2.5", sm: "h-3 w-3", md: "h-3.5 w-3.5", xl: "h-4 w-4" };

/**
 * The green/orange presence dot (the owner, 16/10). Server-safe: it only reads
 * the stamp. Green = מחוברת עכשיו, orange = לא מחוברת; the tooltip and the
 * aria-label carry the exact "נראתה לפני…".
 */
export function PresenceDot({ lastSeen, size = "sm", className }: { lastSeen: string | null | undefined; size?: DotSize; className?: string }) {
  const p = presenceOf(lastSeen);
  return (
    <span
      role="img"
      aria-label={p.title}
      title={p.title}
      data-presence={p.online ? "online" : "offline"}
      className={cn("absolute -bottom-0.5 -start-0.5 rounded-full ring-2 ring-white", DOT[size], p.online ? "bg-[#22C55E]" : "bg-[#F59E0B]", className)}
    />
  );
}

/** Wraps an <Avatar> and pins the dot to its corner. */
export function PresenceAvatar({ lastSeen, size = "sm", children, className }: { lastSeen: string | null | undefined; size?: DotSize; children: ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {children}
      <PresenceDot lastSeen={lastSeen} size={size} />
    </span>
  );
}

/** The words next to a name: "🟢 מחוברת עכשיו" or "🟠 נראתה לפני 12 דק׳". */
export function PresenceText({ lastSeen, className }: { lastSeen: string | null | undefined; className?: string }) {
  const p = presenceOf(lastSeen);
  return (
    <span className={cn(p.online ? "text-success font-semibold" : "text-ink-500", className)} title={p.title}>
      {p.online ? "🟢 " : "🟠 "}
      {p.label}
    </span>
  );
}
