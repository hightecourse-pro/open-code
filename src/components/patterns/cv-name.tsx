"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { renameCv } from "@/app/(app)/cv/actions";

/**
 * The document's display name with an inline rename (member feedback, 14/9:
 * "אפשרות לשנות את שם קורות החיים"). Pencil → input in place → save/cancel.
 */
export function CvName({ id, label, fileName }: { id: string; label: string; fileName: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [pending, start] = useTransition();

  const save = () => {
    const next = value.trim();
    if (!next || next === label) {
      setEditing(false);
      setValue(label);
      return;
    }
    const fd = new FormData();
    fd.set("label", next);
    start(() => renameCv(id, fd).then(() => setEditing(false)));
  };

  return (
    <div className="flex-1 min-w-0">
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={120}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                setEditing(false);
                setValue(label);
              }
            }}
            className="flex-1 min-w-0 text-[13.5px] font-medium border border-brand-purple rounded-md px-2 py-1 outline-none"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending}
            aria-label="שמירת השם"
            className="text-success hover:opacity-75 cursor-pointer disabled:opacity-50"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setValue(label);
            }}
            aria-label="ביטול"
            className="text-ink-400 hover:text-ink-900 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="font-medium text-ink-900 truncate flex items-center gap-1.5 group">
          <span className="truncate">{label}</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="שינוי שם"
            aria-label={`שינוי השם של ${label}`}
            className="text-ink-300 hover:text-brand-purple cursor-pointer shrink-0"
          >
            <Pencil size={12} />
          </button>
        </div>
      )}
      <div className="text-[11px] text-ink-500 truncate">{fileName}</div>
    </div>
  );
}
