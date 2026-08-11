"use client";

// Month-range picker for the practicum_period profile question: two Gregorian
// month+year pickers (התחלה / סיום) plus an "עוד לא סיימתי" checkbox that
// disables the end picker and stores end as "current". Mirrors the date-row
// pattern of ExperienceListEditor and, like it, serializes into one hidden
// input so the FormData-based save flow stays untouched — the value submits
// as {"start":"YYYY-MM","end":"YYYY-MM"} (or "current").

import { useState } from "react";
import { Checkbox, Select } from "@/components/ui";
import type { PracticumPeriod } from "@/lib/experience-entries";

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

function splitYm(ym: string): { month: string; year: string } {
  const [year = "", month = ""] = ym.split("-");
  return { month, year };
}

function joinYm(month: string, year: string): string {
  return month && year ? `${year}-${month}` : "";
}

export interface PeriodPickerProps {
  /** Form field name — the hidden input submits the JSON object. */
  name: string;
  initial: PracticumPeriod;
}

export function PeriodPicker({ name, initial }: PeriodPickerProps) {
  const [period, setPeriod] = useState<PracticumPeriod>(initial);
  const start = splitYm(period.start);
  const notDoneYet = period.end === "current";
  const end = notDoneYet ? { month: "", year: "" } : splitYm(period.end);

  return (
    <div className="flex flex-col gap-1.5">
      {/* One value for the whole range — the server action parses the object. */}
      <input type="hidden" name={name} value={JSON.stringify(period)} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-700">התחלה</span>
          <div className="grid grid-cols-2 gap-2">
            <Select
              aria-label="חודש התחלה"
              value={start.month}
              onChange={(e) => setPeriod((p) => ({ ...p, start: joinYm(e.target.value, start.year) }))}
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
              onChange={(e) => setPeriod((p) => ({ ...p, start: joinYm(start.month, e.target.value) }))}
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
              disabled={notDoneYet}
              onChange={(e) => setPeriod((p) => ({ ...p, end: joinYm(e.target.value, end.year) }))}
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
              disabled={notDoneYet}
              onChange={(e) => setPeriod((p) => ({ ...p, end: joinYm(end.month, e.target.value) }))}
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
            checked={notDoneYet}
            onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.checked ? "current" : "" }))}
            label="עוד לא סיימתי"
          />
        </div>
      </div>
    </div>
  );
}
