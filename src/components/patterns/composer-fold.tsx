"use client";

import { useState } from "react";
import { PenLine, X } from "lucide-react";
import { Composer } from "@/components/patterns/composer";

/**
 * The forum composer behind a button (the owner, 2026-08-28): the topics list
 * is what she came for — it must be visible without scrolling past a form.
 */
export function ComposerFold({ kind = "forum" }: { kind?: "feed" | "forum" }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 font-display font-semibold text-[14px] py-2.5 rounded-[14px] border-[1.5px] border-dashed border-brand-purple/50 text-brand-purple bg-white hover:bg-tint-purple/40 hover:border-brand-purple transition-colors cursor-pointer"
      >
        <PenLine size={15} /> פתיחת פוסט חדש
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="self-end inline-flex items-center gap-1 text-[12px] font-semibold text-ink-500 hover:text-ink-900 cursor-pointer"
      >
        <X size={12} /> סגירה
      </button>
      <Composer kind={kind} />
    </div>
  );
}
