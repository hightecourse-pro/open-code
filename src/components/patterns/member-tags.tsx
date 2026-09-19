import { cn } from "@/lib/utils";
import type { ProfileStatus, UserRole } from "@/types/database";

const STATUS: Record<ProfileStatus, { label: string; cls: string }> = {
  pending: { label: "ממתינה", cls: "bg-tint-pink text-brand-pink-deep" },
  active: { label: "פעילה", cls: "bg-tint-mint text-success" },
  paused: { label: "מושהית", cls: "bg-ink-100 text-ink-500" },
  rejected: { label: "נדחתה", cls: "bg-danger-bg text-danger" },
};

export function StatusPill({ status }: { status: ProfileStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-[11.5px] font-bold", s.cls)}>
      {s.label}
    </span>
  );
}

const ROLE: Record<UserRole, { label: string; cls: string }> = {
  junior: { label: "ג'וניורית", cls: "bg-tint-indigo text-brand-indigo" },
  mentor: { label: "מנטורית 👑", cls: "bg-[linear-gradient(95deg,#FFD166,#E5A93C)] text-[#5A3D00]" },
  admin: { label: "צוות", cls: "bg-ink-1000 text-white" },
};

/**
 * The rank next to a name in the forum (the owner, 18/9: "שיהיה ניתן לראות
 * מי צוות ומי מנטורית ומי משתתפת") — community wording, not the admin's.
 */
const FORUM_RANK: Record<UserRole, { label: string; cls: string }> = {
  admin: { label: "צוות קוד פתוח", cls: "bg-ink-1000 text-white" },
  mentor: { label: "👑 מנטורית", cls: "bg-[linear-gradient(95deg,#FFD166,#E5A93C)] text-[#5A3D00]" },
  junior: { label: "משתתפת", cls: "bg-tint-purple text-brand-purple" },
};

export function ForumRank({ role, size = "sm" }: { role: UserRole | null | undefined; size?: "sm" | "xs" }) {
  if (!role) return null;
  const r = FORUM_RANK[role];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold whitespace-nowrap shrink-0",
        size === "xs" ? "px-1.5 py-px text-[10px]" : "px-2 py-px text-[10.5px]",
        r.cls
      )}
    >
      {r.label}
    </span>
  );
}

export function RoleTag({ role, experienced = false }: { role: UserRole; experienced?: boolean }) {
  const r = ROLE[role];
  // An experienced member is still role=junior in the data — but showing her
  // as plain "ג'וניורית" misled the admin (tester finding). The tag says both.
  const label = role === "junior" && experienced ? "בעלת ניסיון" : r.label;
  const cls = role === "junior" && experienced ? "bg-tint-purple text-brand-purple" : r.cls;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}
