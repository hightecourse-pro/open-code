"use client";

// Repeatable experience-entry editor for the two JSON-array profile questions
// (practical_experience / work_history). Special-cased by key in the profile
// wizard; serializes its entries into one hidden input so the existing
// FormData-based save flow stays untouched.

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  EXPERIENCE_KINDS,
  type ExperienceEntry,
} from "@/lib/experience-entries";

type Option = { value: string; label: string };

export interface ExperienceListEditorProps {
  /** Form field name — the hidden input submits a JSON array of entries. */
  name: string;
  /** "practical" shows the kind select; "work" shows the current-place checkbox. */
  variant: "practical" | "work";
  initial: ExperienceEntry[];
  /** Tech taxonomy options (chips per entry, stored as VALUES). */
  techOptions: Option[];
  error?: boolean;
}

const MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
].map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1985 + 1 }, (_, i) => String(THIS_YEAR - i));

function emptyEntry(variant: "practical" | "work"): ExperienceEntry {
  return {
    ...(variant === "practical" ? { kind: "" } : {}),
    place: "",
    tech: [],
    description: "",
    start: "",
    end: "",
  };
}

function splitYm(ym: string): { month: string; year: string } {
  const [year = "", month = ""] = ym.split("-");
  return { month, year };
}

function joinYm(month: string, year: string): string {
  return month && year ? `${year}-${month}` : "";
}

export function ExperienceListEditor({
  name,
  variant,
  initial,
  techOptions,
  error,
}: ExperienceListEditorProps) {
  const [entries, setEntries] = useState<ExperienceEntry[]>(initial);

  function patch(i: number, changes: Partial<ExperienceEntry>) {
    setEntries((list) => list.map((e, j) => (j === i ? { ...e, ...changes } : e)));
  }

  /** work_history: only one entry may be "מקום נוכחי/אחרון" — checking clears the rest. */
  function setCurrent(i: number, on: boolean) {
    setEntries((list) =>
      list.map((e, j) => {
        if (j === i) return { ...e, current: on || undefined };
        return e.current ? { ...e, current: undefined } : e;
      })
    );
  }

  const addLabel = variant === "practical" ? "הוספת התנסות" : "הוספת מקום עבודה";

  return (
    <div className="flex flex-col gap-3">
      {/* One value for the whole list — the server action parses the array. */}
      <input type="hidden" name={name} value={JSON.stringify(entries)} />

      {entries.map((entry, i) => {
        const start = splitYm(entry.start);
        const untilNow = entry.end === "current";
        const end = untilNow ? { month: "", year: "" } : splitYm(entry.end);
        return (
          <div
            key={i}
            className={cn(
              "rounded-[14px] border p-4 flex flex-col gap-3",
              error ? "border-danger/60" : "border-ink-200"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-ink-500">
                {variant === "practical" ? "התנסות" : "מקום עבודה"} {i + 1}
              </span>
              <button
                type="button"
                aria-label="הסרת הרשומה"
                onClick={() => setEntries((list) => list.filter((_, j) => j !== i))}
                className="text-ink-400 hover:text-danger p-1 -m-1"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {variant === "practical" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-ink-700">סוג ההתנסות</span>
                  <Select
                    value={entry.kind ?? ""}
                    onChange={(e) => patch(i, { kind: e.target.value })}
                  >
                    <option value="">בחרי…</option>
                    {EXPERIENCE_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className={cn("flex flex-col gap-1.5", variant === "work" && "sm:col-span-2")}>
                <span className="text-xs font-semibold text-ink-700">מקום</span>
                <Input
                  value={entry.place}
                  onChange={(e) => patch(i, { place: e.target.value })}
                  placeholder="שם החברה / הארגון / הלקוח"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-ink-700">טכנולוגיות</span>
              <div className="flex flex-wrap gap-2">
                {techOptions.map((o) => {
                  const on = entry.tech.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        patch(i, {
                          tech: on
                            ? entry.tech.filter((t) => t !== o.value)
                            : [...entry.tech, o.value],
                        })
                      }
                      className={cn(
                        "inline-flex items-center px-3 py-[5px] rounded-full text-xs font-semibold",
                        "transition-colors duration-150 border cursor-pointer",
                        on
                          ? "bg-brand-pink-deep text-white border-brand-pink-deep"
                          : "bg-ink-0 text-ink-700 border-ink-200 hover:border-brand-purple"
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-ink-700">תיאור חופשי</span>
              <Textarea
                value={entry.description}
                onChange={(e) => patch(i, { description: e.target.value })}
                placeholder="מה עשית שם בפועל? באיזה צוות, על מה עבדת…"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink-700">התחלה</span>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    aria-label="חודש התחלה"
                    value={start.month}
                    onChange={(e) => patch(i, { start: joinYm(e.target.value, start.year) })}
                  >
                    <option value="">חודש…</option>
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="שנת התחלה"
                    value={start.year}
                    onChange={(e) => patch(i, { start: joinYm(start.month, e.target.value) })}
                  >
                    <option value="">שנה…</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-ink-700">סיום</span>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    aria-label="חודש סיום"
                    value={end.month}
                    disabled={untilNow}
                    onChange={(e) => patch(i, { end: joinYm(e.target.value, end.year) })}
                  >
                    <option value="">חודש…</option>
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label="שנת סיום"
                    value={end.year}
                    disabled={untilNow}
                    onChange={(e) => patch(i, { end: joinYm(end.month, e.target.value) })}
                  >
                    <option value="">שנה…</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </Select>
                </div>
                <Checkbox
                  checked={untilNow}
                  onChange={(e) => patch(i, { end: e.target.checked ? "current" : "" })}
                  label="עד היום"
                />
              </div>
            </div>

            {variant === "work" && (
              <Checkbox
                checked={!!entry.current}
                onChange={(e) => setCurrent(i, e.target.checked)}
                label="מקום נוכחי/אחרון"
              />
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setEntries((list) => [...list, emptyEntry(variant)])}
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-ink-300",
          "px-4 py-2 text-[13px] font-semibold text-ink-700 transition-colors",
          "hover:border-brand-pink-deep hover:text-brand-pink-deep"
        )}
      >
        <Plus size={15} /> {addLabel}
      </button>
    </div>
  );
}
