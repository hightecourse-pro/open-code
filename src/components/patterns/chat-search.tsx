"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface ChatSearchItem {
  id: string;
  name: string;
}

/**
 * Name search over the conversation list, with autocomplete (the owner, 2/9)
 * — typing narrows, a click (or Enter) jumps straight into the conversation.
 */
export function ChatSearch({ items }: { items: ChatSearchItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const needle = q.trim();
    if (!needle) return [];
    return items.filter((i) => i.name.includes(needle)).slice(0, 7);
  }, [items, q]);

  const go = (id: string) => {
    setQ("");
    setOpen(false);
    router.push(`/chat?c=${id}`);
  };

  return (
    <div ref={wrapRef} className="relative p-1.5 pb-2">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && matches[highlight]) {
            e.preventDefault();
            go(matches[highlight].id);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="חיפוש שיחה לפי שם… 🔍"
        aria-label="חיפוש שיחה לפי שם"
        className="w-full border border-ink-200 rounded-md px-3 py-1.5 text-[13px] focus:outline-none focus:border-brand-purple"
      />
      {open && matches.length > 0 && (
        <div className="absolute inset-x-1.5 top-full -mt-0.5 z-20 bg-white border border-ink-200 rounded-md shadow-md overflow-hidden">
          {matches.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(m.id)}
              className={cn(
                "w-full text-start px-3 py-2 text-[13px] cursor-pointer",
                i === highlight ? "bg-tint-purple/60 text-brand-purple font-semibold" : "hover:bg-ink-50"
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
      {open && q.trim() && matches.length === 0 && (
        <div className="absolute inset-x-1.5 top-full -mt-0.5 z-20 bg-white border border-ink-200 rounded-md shadow-md px-3 py-2 text-[12.5px] text-ink-500">
          אין שיחה עם השם הזה — אפשר לפתוח חדשה מ&quot;שיחה חדשה&quot; למעלה
        </div>
      )}
    </div>
  );
}
