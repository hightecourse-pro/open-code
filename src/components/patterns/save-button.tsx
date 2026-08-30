"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * A submit button that SAYS what's happening (the owner, 30/8: "צריכה להיות
 * אינדיקציה של שמירה אחרי שנשמר"): pending → "שומר…", then a green
 * "נשמר ✓" flash for a moment.
 */
export function SaveButton({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const was = wasPending.current;
    wasPending.current = pending;
    if (was && !pending) {
      setSavedFlash(true);
      const t = setTimeout(() => setSavedFlash(false), 2500);
      return () => clearTimeout(t);
    }
  }, [pending]);

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "text-[12px] font-semibold rounded-md px-3.5 py-1.5 transition-colors",
        savedFlash
          ? "bg-tint-mint text-[#0F6E4A] border border-[#BFE4D1]"
          : "text-white bg-brand-gradient disabled:opacity-60",
        className
      )}
    >
      {pending ? "שומר…" : savedFlash ? "נשמר ✓" : label}
    </button>
  );
}
