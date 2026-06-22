"use client";

import { useState, useTransition } from "react";
import { Star, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveInternalNotes, toggleVip } from "@/app/(admin)/admin/actions";

export function MemberCrm({
  id,
  isVip,
  notes,
}: {
  id: string;
  isVip: boolean;
  notes: string | null;
}) {
  const [vip, setVip] = useState(isVip);
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(notes ?? "");
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            const next = !vip;
            setVip(next);
            start(() => void toggleVip(id, next));
          }}
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border transition-colors",
            vip
              ? "bg-tint-warm border-[#F8D98C] text-[#8C5E0E]"
              : "bg-white border-ink-200 text-ink-500 hover:border-brand-pink"
          )}
        >
          <Star size={12} fill={vip ? "currentColor" : "none"} /> VIP
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border border-ink-200 text-ink-500 hover:border-brand-purple"
        >
          <StickyNote size={12} /> הערות
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-1 w-56">
          <textarea
            value={val}
            onChange={(e) => {
              setVal(e.target.value);
              setSaved(false);
            }}
            rows={3}
            placeholder="הערות פנימיות לסינון…"
            className="w-full text-[12px] border border-ink-300 rounded-md p-2 outline-none focus:border-brand-purple"
          />
          <button
            type="button"
            onClick={() =>
              start(() => {
                void saveInternalNotes(id, val);
                setSaved(true);
              })
            }
            className="self-end text-[11px] font-semibold text-brand-purple"
          >
            {saved ? "נשמר ✓" : "שמירה"}
          </button>
        </div>
      )}
    </div>
  );
}
