"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { addTaxonomy, removeTaxonomy } from "@/app/(admin)/admin/actions";
import type { ConfigTaxonomy, TaxonomyKind } from "@/types/database";

export function TaxonomyManager({
  kind,
  label,
  items,
}: {
  kind: TaxonomyKind;
  label: string;
  items: ConfigTaxonomy[];
}) {
  const [list, setList] = useState(items);
  const [val, setVal] = useState("");
  const [, start] = useTransition();

  function add() {
    const v = val.trim();
    if (!v) return;
    // Optimistic; server returns void. A reload reconciles ids on next render.
    const temp: ConfigTaxonomy = {
      id: `temp-${Date.now()}`,
      kind,
      value: v,
      label_he: v,
      sort_order: list.length + 1,
      active: true,
      created_at: new Date().toISOString(),
    };
    setList((l) => [...l, temp]);
    setVal("");
    start(() => void addTaxonomy(kind, v));
  }

  function remove(id: string) {
    setList((l) => l.filter((t) => t.id !== id));
    if (!id.startsWith("temp-")) start(() => void removeTaxonomy(id));
  }

  return (
    <div>
      <div className="text-[11px] text-ink-500 tracking-[0.04em] uppercase font-semibold mb-2">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {list.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1">
            <Badge variant={kind === "tech" ? "tech" : "purple"}>{t.label_he}</Badge>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="text-ink-400 hover:text-danger -ms-1"
              title="הסרה"
            >
              <X size={13} />
            </button>
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="תגית חדשה…"
            className="w-28 text-[12px] border border-ink-300 rounded-md px-2 py-1 outline-none focus:border-brand-purple"
          />
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-gradient text-white"
            title="הוספה"
          >
            <Plus size={14} />
          </button>
        </span>
      </div>
    </div>
  );
}
