"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "oc-hackathon-news-seen";
const PREVIEW = 2;

/**
 * "מה חדש" on the community hackathon page (the owner, 16/10: "תופס הרבה מאוד
 * מקום - פתוח רק כשיש חדש, שרואים את האחרונים עם קרא עוד, אחרת לפתוח יזום").
 * Opens by itself only when this browser has not seen the current version:
 * the latest two lines + "קרא עוד". Otherwise a slim collapsed row that opens
 * on demand. The version is remembered per browser once the open card is shown.
 */
export function WhatsNew({ updates, version }: { updates: { date: string; text: string }[]; version: string }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      let seen = version;
      try {
        seen = localStorage.getItem(KEY) ?? "";
      } catch {}
      if (seen !== version) {
        setFresh(true);
        setOpen(true);
        try {
          localStorage.setItem(KEY, version);
        } catch {}
      }
    }, 0);
    return () => clearTimeout(t);
  }, [version]);
  if (updates.length === 0) return null;
  const latest = updates[0];
  const shown = all ? updates : updates.slice(0, PREVIEW);
  return (
    <section className="bg-white border border-ink-200 rounded-[18px] shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full px-5 py-3 flex items-center gap-2.5 text-start"
      >
        <h2 className="font-display font-bold text-[15px] text-ink-1000">מה חדש</h2>
        {fresh && <span className="rounded-full bg-brand-gradient text-white text-[10.5px] font-bold px-2 py-0.5">חדש</span>}
        {!open && (
          <span className="flex-1 min-w-0 text-[13px] text-ink-600 truncate">
            <span className="font-mono text-[11.5px] text-ink-500">{latest.date}</span> · {latest.text}
          </span>
        )}
        {open && <span className="flex-1" />}
        <span className="text-[12px] text-ink-500 whitespace-nowrap">{open ? "סגירה" : `${updates.length} עדכונים`}</span>
        <ChevronDown size={16} className={cn("text-ink-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 pb-4">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {shown.map((u) => (
              <li key={u.text} className="flex items-start gap-2 text-[13.5px] text-ink-800">
                <span className="font-mono text-[11.5px] text-ink-500 mt-0.5 shrink-0">{u.date}</span>
                <span>{u.text}</span>
              </li>
            ))}
          </ul>
          {updates.length > PREVIEW && (
            <button
              type="button"
              onClick={() => setAll((a) => !a)}
              className="mt-2.5 text-[13px] font-bold text-brand-purple hover:underline"
            >
              {all ? "פחות" : `קרא עוד (${updates.length - PREVIEW} עדכונים קודמים)`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
