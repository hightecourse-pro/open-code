"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** A tiny "העתקה" button next to a credential or a code. */
export function CopyTextButton({ text, label = "העתקה" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked - the text is selectable anyway */
        }
      }}
      className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-purple hover:underline shrink-0"
      aria-label={label}
      title={label}
    >
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? "הועתק" : label}
    </button>
  );
}
