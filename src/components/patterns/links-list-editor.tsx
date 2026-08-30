"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui";
import { parseLinkItems, type LinkItem } from "@/lib/link-items";

/**
 * Structured link lists in the profile wizard (the owner, 31/8: "בקישורים
 * צריך גם כותרת והסבר קצר על הקישור") — each link carries a URL, a title and
 * a short note the recruiter sees. Serialized into one hidden input as JSON;
 * legacy answers (plain one-URL-per-line strings) are hydrated as URL-only
 * rows so nothing anyone already saved is lost.
 */
export function LinksListEditor({
  name,
  initial,
  addLabel = "הוספת קישור",
}: {
  name: string;
  initial: unknown;
  addLabel?: string;
}) {
  const [rows, setRows] = useState<LinkItem[]>(() => parseLinkItems(initial));

  const patch = (i: number, part: Partial<LinkItem>) =>
    setRows((list) => list.map((r, j) => (j === i ? { ...r, ...part } : r)));

  return (
    <div className="flex flex-col gap-2.5">
      <input type="hidden" name={name} value={JSON.stringify(rows.filter((r) => r.url.trim()))} />
      {rows.map((r, i) => (
        <div key={i} className="rounded-[12px] border border-ink-200 bg-ink-0/60 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              value={r.url}
              onChange={(e) => patch(i, { url: e.target.value })}
              dir="ltr"
              placeholder="https://…"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setRows((list) => list.filter((_, j) => j !== i))}
              className="text-ink-400 hover:text-danger cursor-pointer shrink-0"
              aria-label="הסרת הקישור"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={r.title}
              onChange={(e) => patch(i, { title: e.target.value })}
              placeholder="כותרת — מה זה? (למשל: בוט וואטסאפ לניהול תורים)"
            />
            <Input
              value={r.note}
              onChange={(e) => patch(i, { note: e.target.value })}
              placeholder="הסבר קצר — מה שווה לראות שם"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((list) => [...list, { url: "", title: "", note: "" }])}
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-ink-300 px-4 py-2 text-[13px] font-semibold text-ink-700 transition-colors hover:border-brand-pink-deep hover:text-brand-pink-deep cursor-pointer"
      >
        <Plus size={15} /> {addLabel}
      </button>
    </div>
  );
}
