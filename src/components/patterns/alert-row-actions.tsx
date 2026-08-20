"use client";

import { useTransition } from "react";
import { Check, CheckCheck } from "lucide-react";
import { markAlertRead, markAllAlertsRead } from "@/app/(admin)/admin/alerts/actions";

export function MarkReadButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => markAlertRead(id))}
      className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-500 hover:text-brand-purple transition-colors disabled:opacity-50 cursor-pointer"
    >
      <Check size={13} /> סימון כנקראה
    </button>
  );
}

export function MarkAllReadButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => markAllAlertsRead())}
      className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-purple hover:underline disabled:opacity-50 cursor-pointer"
    >
      <CheckCheck size={14} /> {pending ? "מסמנת…" : "סימון הכול כנקרא"}
    </button>
  );
}
