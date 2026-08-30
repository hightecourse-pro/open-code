"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { addTaxonomy, removeTaxonomy } from "@/app/(admin)/admin/actions";
import type { ConfigTaxonomy, TaxonomyKind } from "@/types/database";

/**
 * One editable taxonomy list. Lists whose rows carry a group (the tech list)
 * render as group sections, each with its own add box — and a new group is
 * born by naming it and giving it its first value.
 */
export function TaxonomyManager({
  kind,
  label,
  items,
  otherValues = [],
}: {
  kind: TaxonomyKind;
  label: string;
  items: ConfigTaxonomy[];
  /** Free-typed values members wrote under "אחר" — adoption candidates. */
  otherValues?: string[];
}) {
  const [list, setList] = useState(items);
  const [adoptGroup, setAdoptGroup] = useState("");
  const [adopted, setAdopted] = useState<Set<string>>(new Set());
  const [vals, setVals] = useState<Record<string, string>>({});
  const [newGroup, setNewGroup] = useState("");
  const [newGroupVal, setNewGroupVal] = useState("");
  const [, start] = useTransition();

  const grouped = list.some((t) => t.group_he);

  function add(group: string | null, raw: string, clear: () => void) {
    const v = raw.trim();
    if (!v) return;
    // Optimistic; server returns void. A reload reconciles ids on next render.
    const temp: ConfigTaxonomy = {
      id: `temp-${list.length}-${v}`,
      kind,
      value: v,
      label_he: v,
      group_he: group,
      sort_order: list.length + 1,
      active: true,
      created_at: "",
    };
    setList((l) => [...l, temp]);
    clear();
    start(() => void addTaxonomy(kind, v, group ?? undefined));
  }

  function remove(id: string) {
    setList((l) => l.filter((t) => t.id !== id));
    if (!id.startsWith("temp-")) start(() => void removeTaxonomy(id));
  }

  const groupNames = [...new Set(list.map((t) => t.group_he).filter((g): g is string => !!g))];
  const pendingOther = otherValues.filter(
    (v) => !adopted.has(v) && !list.some((t) => t.label_he === v || t.value === v)
  );
  function adopt(v: string) {
    setAdopted((s) => new Set([...s, v]));
    const temp: ConfigTaxonomy = {
      id: `temp-adopt-${v}`, kind, value: v, label_he: v,
      group_he: adoptGroup || null, sort_order: list.length + 1, active: true, created_at: "",
    };
    setList((l) => [...l, temp]);
    start(() => void addTaxonomy(kind, v, adoptGroup || undefined));
  }

  // A render helper, not a component — a component born inside render would
  // remount (and drop the add-box focus) on every keystroke.
  const renderChips = (rows: ConfigTaxonomy[], group: string | null) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {rows.map((t) => (
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
          value={vals[group ?? "_"] ?? ""}
          onChange={(e) => setVals((s) => ({ ...s, [group ?? "_"]: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(group, vals[group ?? "_"] ?? "", () => setVals((s) => ({ ...s, [group ?? "_"]: "" })));
            }
          }}
          placeholder="ערך חדש…"
          className="w-28 text-[12px] border border-ink-300 rounded-md px-2 py-1 outline-none focus:border-brand-purple"
        />
        <button
          type="button"
          onClick={() => add(group, vals[group ?? "_"] ?? "", () => setVals((s) => ({ ...s, [group ?? "_"]: "" })))}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-gradient text-white cursor-pointer"
          title="הוספה"
        >
          <Plus size={14} />
        </button>
      </span>
    </div>
  );

  if (!grouped) {
    return (
      <div>
        <div className="text-[11px] text-ink-500 tracking-[0.04em] uppercase font-semibold mb-2">
          {label}
        </div>
        {renderChips(list, null)}
      {pendingOther.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dashed border-[#EAD9A8] flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] font-bold text-[#8C5E0E]">נכתב תחת &quot;אחר&quot;:</span>
          <select
            value={adoptGroup}
            onChange={(e) => setAdoptGroup(e.target.value)}
            className="text-[12px] border border-ink-300 rounded-md px-2 py-1"
            title="לאיזו קטגוריה לאמץ"
          >
            <option value="">בלי קטגוריה</option>
            {groupNames.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          {pendingOther.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => adopt(v)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold bg-tint-warm text-[#8C5E0E] border border-[#EAD9A8] rounded-full px-3 py-1 cursor-pointer hover:border-[#E5A93C]"
              title="לחיצה מוסיפה לרשימה בקטגוריה שנבחרה"
            >
              <Plus size={12} /> {v}
            </button>
          ))}
        </div>
      )}
      </div>
    );
  }

  // Group order follows the rows' order; ungrouped leftovers close the list.
  const groups: { name: string | null; rows: ConfigTaxonomy[] }[] = [];
  for (const t of list) {
    const name = t.group_he ?? null;
    const g = groups.find((x) => x.name === name);
    if (g) g.rows.push(t);
    else groups.push({ name, rows: [t] });
  }

  return (
    <div>
      <div className="text-[11px] text-ink-500 tracking-[0.04em] uppercase font-semibold mb-2">
        {label}
      </div>
      <div className="flex flex-col gap-3">
        {groups.map((g) => (
          <div key={g.name ?? "_"}>
            {g.name && (
              <div className="text-[12px] font-bold text-brand-purple mb-1.5">{g.name}</div>
            )}
            {renderChips(g.rows, g.name)}
          </div>
        ))}
      </div>
      {pendingOther.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dashed border-[#EAD9A8] flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] font-bold text-[#8C5E0E]">נכתב תחת &quot;אחר&quot;:</span>
          <select
            value={adoptGroup}
            onChange={(e) => setAdoptGroup(e.target.value)}
            className="text-[12px] border border-ink-300 rounded-md px-2 py-1"
            title="לאיזו קטגוריה לאמץ"
          >
            <option value="">בלי קטגוריה</option>
            {groupNames.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          {pendingOther.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => adopt(v)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold bg-tint-warm text-[#8C5E0E] border border-[#EAD9A8] rounded-full px-3 py-1 cursor-pointer hover:border-[#E5A93C]"
              title="לחיצה מוסיפה לרשימה בקטגוריה שנבחרה"
            >
              <Plus size={12} /> {v}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3">

        {/* A new group: name it + its first technology. */}
        <div className="border-t border-ink-100 pt-2.5 flex items-end gap-2 flex-wrap">
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-ink-500">
            קבוצה חדשה
            <Input
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="למשל: אבטחת מידע"
              className="w-40 py-1.5 text-[12.5px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-ink-500">
            טכנולוגיה ראשונה בקבוצה
            <Input
              value={newGroupVal}
              onChange={(e) => setNewGroupVal(e.target.value)}
              placeholder="למשל: OWASP"
              className="w-40 py-1.5 text-[12.5px]"
            />
          </label>
          <Button
            type="button"
            size="sm"
            disabled={!newGroup.trim() || !newGroupVal.trim()}
            onClick={() =>
              add(newGroup.trim(), newGroupVal, () => {
                setNewGroup("");
                setNewGroupVal("");
              })
            }
          >
            יצירת קבוצה +
          </Button>
        </div>
      </div>
    </div>
  );
}
