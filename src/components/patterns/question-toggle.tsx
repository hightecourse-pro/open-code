"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toggleQuestionActive } from "@/app/(admin)/admin/actions";

export function QuestionToggle({ id, active }: { id: string; active: boolean }) {
  const [on, setOn] = useState(active);
  const [pending, start] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      {/* Colored state so it's obvious at a glance which questions are live. */}
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full",
          on ? "bg-tint-mint text-[#1B7A4B]" : "bg-ink-100 text-ink-400"
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full", on ? "bg-[#28A864]" : "bg-ink-300")} />
        {on ? "פעילה" : "כבויה"}
      </span>
      <Switch
        checked={on}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(() => void toggleQuestionActive(id, next));
        }}
      />
    </span>
  );
}
