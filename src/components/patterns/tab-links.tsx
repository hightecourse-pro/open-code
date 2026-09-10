"use client";

// URL-driven tab bars used plain <a> links — a full page load with zero
// feedback, which reads as "stuck" (the owner, 10/9). This renders the same
// links through the client router inside a transition: the clicked tab shows
// a spinner immediately, and the current content stays until the new view is
// ready.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TabLinkItem {
  id: string;
  href: string;
  label: string;
  title?: string;
}

export function TabLinks({
  items,
  activeId,
  activeClass,
  idleClass,
  baseClass,
}: {
  items: TabLinkItem[];
  activeId: string;
  /** Exact class strings, so each tab bar keeps its existing look. */
  baseClass: string;
  activeClass: string;
  idleClass: string;
}) {
  const router = useRouter();
  const [pending, startNav] = useTransition();
  const [target, setTarget] = useState<string | null>(null);

  return (
    <>
      {items.map((item) => {
        const active = item.id === activeId;
        const loading = pending && target === item.id;
        return (
          <a
            key={item.id}
            href={item.href}
            title={item.title}
            aria-current={active ? "page" : undefined}
            onClick={(e) => {
              // Plain click only — modified clicks (new tab) keep native behavior.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              if (active) return;
              setTarget(item.id);
              startNav(() => router.push(item.href));
            }}
            className={cn(baseClass, active ? activeClass : idleClass, loading && "opacity-80")}
          >
            {loading && <Loader2 size={13} className="inline-block animate-spin me-1.5 align-[-2px]" />}
            {item.label}
          </a>
        );
      })}
    </>
  );
}
