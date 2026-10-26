"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const EVENT = "collapsible-section";
function read(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/**
 * A section that folds (the owner, 25/10 for the hackathon admin; 26/10 for the
 * judging desk - "אפשרות להרחיב ולכווץ כל מקטע"): a slim header with the title and
 * a one-line summary, the body under it. The state is remembered per section in
 * this browser (`scope` keeps pages apart); without storage it still folds for
 * the page's lifetime.
 */
export function Collapsible({ id, title, summary, defaultOpen = true, scope = "hackathon-section", compact = false, children }: { id: string; title: string; summary?: ReactNode; defaultOpen?: boolean; scope?: string; compact?: boolean; children: ReactNode }) {
  const key = `${scope}:${id}`;
  const stored = useSyncExternalStore(subscribe, () => read(key, defaultOpen), () => defaultOpen);
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? stored;
  function toggle() {
    const next = !open;
    setOverride(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* no storage - the override carries the state */
    }
  }
  return (
    <section className={compact ? "flex flex-col gap-1.5" : "flex flex-col gap-2"} data-testid={`section-${id}`} data-open={open ? "1" : "0"}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex items-center gap-2 text-start rounded-[12px] border border-ink-200 hover:border-brand-purple/60 transition-colors ${compact ? "px-2.5 py-1.5 bg-ink-50/80" : "px-3 py-2 bg-white/70"}`}
        data-testid="section-toggle"
      >
        <ChevronDown size={16} className={`shrink-0 text-ink-500 transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="font-display font-bold text-[14px] text-ink-1000">{title}</span>
        {summary && <span className="text-[12.5px] text-ink-500 truncate">{summary}</span>}
        <span className="ms-auto text-[11.5px] text-ink-400 shrink-0">{open ? "לכווץ" : "להרחיב"}</span>
      </button>
      {open && <div className={compact ? "flex flex-col gap-3" : "flex flex-col gap-4"}>{children}</div>}
    </section>
  );
}
