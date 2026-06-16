"use client";

import { useTransition } from "react";
import { Check, Pause, Play, X } from "lucide-react";
import { setMemberStatus } from "@/app/(admin)/admin/actions";
import { cn } from "@/lib/utils";
import type { ProfileStatus } from "@/types/database";

function IcBtn({
  onClick,
  title,
  tone,
  disabled,
  children,
}: {
  onClick: () => void;
  title: string;
  tone?: "ok" | "no";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        "w-7 h-7 rounded-lg bg-ink-100 hover:bg-ink-200 flex items-center justify-center transition-colors disabled:opacity-50",
        tone === "ok" && "text-success",
        tone === "no" && "text-danger",
        !tone && "text-ink-700"
      )}
    >
      {children}
    </button>
  );
}

export function MemberActions({
  profileId,
  status,
}: {
  profileId: string;
  status: ProfileStatus;
}) {
  const [pending, start] = useTransition();
  const set = (s: ProfileStatus) => start(() => void setMemberStatus(profileId, s));

  return (
    <div className="flex gap-1">
      {(status === "pending" || status === "rejected") && (
        <IcBtn onClick={() => set("active")} title="אישור" tone="ok" disabled={pending}>
          <Check size={12} strokeWidth={2.5} />
        </IcBtn>
      )}
      {status === "pending" && (
        <IcBtn onClick={() => set("rejected")} title="דחייה" tone="no" disabled={pending}>
          <X size={12} strokeWidth={2.5} />
        </IcBtn>
      )}
      {status === "active" && (
        <IcBtn onClick={() => set("paused")} title="השהיה" disabled={pending}>
          <Pause size={12} strokeWidth={2.5} />
        </IcBtn>
      )}
      {status === "paused" && (
        <IcBtn onClick={() => set("active")} title="הפעלה מחדש" tone="ok" disabled={pending}>
          <Play size={12} strokeWidth={2.5} />
        </IcBtn>
      )}
    </div>
  );
}
