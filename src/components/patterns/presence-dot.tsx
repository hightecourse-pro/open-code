import type { ReactNode } from "react";
import { presenceOf } from "@/lib/presence";
import { cn } from "@/lib/utils";

type DotSize = "xs" | "sm" | "md" | "xl";
const DOT: Record<DotSize, string> = { xs: "h-2 w-2", sm: "h-2 w-2", md: "h-2.5 w-2.5", xl: "h-3 w-3" };
/** Team members carry no presence mark at all (the owner, 18/10). */
const hidden = (role: string | null | undefined) => role === "admin";

/**
 * The green/orange presence dot (the owner, 16/10). Server-safe: it only reads
 * the stamp. Green = מחוברת עכשיו, orange = לא מחוברת; the tooltip and the
 * aria-label carry the exact "נראתה לפני…".
 */
export function PresenceDot({ lastSeen, size = "sm", className, role }: { lastSeen: string | null | undefined; size?: DotSize; className?: string; role?: string | null }) {
  if (hidden(role)) return null;
  const p = presenceOf(lastSeen);
  return (
    <span
      role="img"
      aria-label={p.title}
      title={p.title}
      data-presence={p.online ? "online" : "offline"}
      className={cn("absolute bottom-0 start-0 rounded-full ring-[1.5px] ring-white", DOT[size], p.online ? "bg-[#4CC38A]" : "bg-[#F4B860]", className)}
    />
  );
}

/** Wraps an <Avatar> and pins the dot to its corner. */
export function PresenceAvatar({ lastSeen, size = "sm", children, className, role }: { lastSeen: string | null | undefined; size?: DotSize; children: ReactNode; className?: string; role?: string | null }) {
  if (hidden(role)) return <>{children}</>;
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {children}
      <PresenceDot lastSeen={lastSeen} size={size} />
    </span>
  );
}

/** The words next to a name: "🟢 מחוברת עכשיו" or "🟠 נראתה לפני 12 דק׳". */
export function PresenceText({ lastSeen, className, role }: { lastSeen: string | null | undefined; className?: string; role?: string | null }) {
  if (hidden(role)) return null;
  const p = presenceOf(lastSeen);
  return (
    <span className={cn(p.online ? "text-success font-semibold" : "text-ink-500", className)} title={p.title}>
      {p.online ? "🟢 " : "🟠 "}
      {p.label}
    </span>
  );
}
