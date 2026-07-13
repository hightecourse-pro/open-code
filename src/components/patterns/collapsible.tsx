"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Collapsible({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-semibold text-ink-700 hover:text-ink-1000 self-start"
      >
        <ChevronDown size={16} className={cn("transition-transform", open ? "" : "-rotate-90")} />
        {title}
        {count != null && <span className="text-ink-400 font-normal">({count})</span>}
      </button>
      {open && <div className="flex flex-col gap-3">{children}</div>}
    </div>
  );
}
