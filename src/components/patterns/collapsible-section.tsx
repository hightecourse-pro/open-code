"use client";

import { useId, useSyncExternalStore, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// The open/closed choice lives in localStorage (per storageKey) so it survives
// reloads. It's read through useSyncExternalStore: the server snapshot says
// "unknown", so SSR and hydration render defaultOpen and the remembered state
// applies right after mount — a one-frame flash instead of a hydration
// mismatch. A memory fallback keeps the toggle working when storage is
// unavailable (private mode).
const memoryStore = new Map<string, string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readStored(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) return value;
  } catch {
    // Storage unavailable — the memory fallback answers.
  }
  return memoryStore.get(key) ?? null;
}

function writeStored(key: string, value: string) {
  memoryStore.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not persisted — still toggles for this visit via the memory fallback.
  }
  listeners.forEach((notify) => notify());
}

/** Open a section from the outside (e.g. a "jump to the library" link). */
export function openCollapsible(storageKey: string) {
  writeStored(storageKey, "open");
}

/**
 * A card section she can fold away — the whole header is the toggle, and her
 * choice is remembered per section (storageKey) across visits. While it's
 * closed, a count badge keeps saying how much is waiting inside.
 */
export function CollapsibleSection({
  title,
  subtitle,
  count,
  storageKey,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  /** localStorage key that remembers open/closed, e.g. "jobs:mine". */
  storageKey: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const bodyId = useId();
  const stored = useSyncExternalStore(
    subscribe,
    () => readStored(storageKey),
    () => null
  );
  const open = stored === "open" ? true : stored === "closed" ? false : defaultOpen;

  return (
    <section className="bg-white border border-ink-200 rounded-[18px] shadow-sm">
      <button
        type="button"
        onClick={() => writeStored(storageKey, open ? "closed" : "open")}
        aria-expanded={open}
        aria-controls={bodyId}
        className="w-full flex items-center gap-3 p-5 text-start cursor-pointer"
      >
        <span className="flex-1 min-w-0">
          <span className="block font-display text-[19px] font-black text-ink-1000">{title}</span>
          {subtitle && <span className="block text-[13px] text-ink-700">{subtitle}</span>}
        </span>
        {!open && count != null && (
          <span className="inline-flex items-center justify-center min-w-[26px] h-[26px] px-2 rounded-full bg-tint-purple text-brand-purple text-[12.5px] font-bold">
            {count}
          </span>
        )}
        <ChevronDown
          size={18}
          aria-hidden
          className={cn(
            "shrink-0 text-ink-500 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {/* hidden lives on a class-free div: a display utility on the same
          element would override the attribute and the body would never fold. */}
      <div id={bodyId} hidden={!open}>
        <div className="px-5 pb-5 flex flex-col gap-4">{children}</div>
      </div>
    </section>
  );
}
