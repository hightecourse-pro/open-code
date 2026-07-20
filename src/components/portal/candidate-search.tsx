"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { Alert, Avatar, Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { applyFilters } from "@/lib/portal/filters";
import { smartSearch, type SmartSearchState } from "@/app/portal/search-actions";
import type { CandidateDetail } from "@/lib/portal/types";

export interface CatalogueField {
  key: string;
  label: string;
  values: string[];
}

interface Props {
  candidates: CandidateDetail[];
  catalogue: CatalogueField[];
}

const INITIAL: SmartSearchState = { status: "idle" };

/**
 * How many candidates each value of one parameter would match, using the same
 * case-insensitive containment rule as applyFilters. Computed once per
 * parameter rather than per rendered chip.
 */
function countsFor(
  candidates: CandidateDetail[],
  key: string,
  values: string[]
): Map<string, number> {
  const pools = candidates.map((c) =>
    (c.fields.find((f) => f.key === key)?.values ?? []).map((v) => v.toLowerCase())
  );
  return new Map(
    values.map((value) => {
      const needle = value.toLowerCase();
      return [value, pools.filter((pool) => pool.some((v) => v.includes(needle))).length];
    })
  );
}

export function CandidateSearch({ candidates, catalogue }: Props) {
  // Which parameter's value list is open. Filters accumulate across parameters,
  // so switching this only changes what's on screen, never what's selected.
  const [activeKey, setActiveKey] = useState(catalogue[0]?.key ?? "");
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [valueQuery, setValueQuery] = useState("");
  const [smart, submitSmart, smartPending] = useActionState(smartSearch, INITIAL);
  // useActionState has no reset, so "ניקוי" parks the last result instead of
  // reloading the page (which would throw away the structured selection too).
  const [smartCleared, setSmartCleared] = useState(false);

  const active = catalogue.find((f) => f.key === activeKey) ?? null;

  const visibleValues = useMemo(() => {
    if (!active) return [];
    const q = valueQuery.trim().toLowerCase();
    return q ? active.values.filter((v) => v.toLowerCase().includes(q)) : active.values;
  }, [active, valueQuery]);

  const counts = useMemo(
    () => (active ? countsFor(candidates, active.key, active.values) : new Map<string, number>()),
    [candidates, active]
  );

  const smartActive = smart.status === "ok" && !smartCleared;

  // Structured filters first, then the AI's filters on top — both only narrow,
  // so order doesn't change the result and the two searches compose freely.
  const results = useMemo(() => {
    const structured = applyFilters(candidates, selected, "");
    return smart.status === "ok" && !smartCleared
      ? applyFilters(structured, smart.filters, smart.freeText)
      : structured;
  }, [candidates, selected, smart, smartCleared]);

  const chips = Object.entries(selected).flatMap(([key, values]) =>
    values.map((value) => ({
      key,
      value,
      label: catalogue.find((f) => f.key === key)?.label ?? key,
    }))
  );

  function toggle(key: string, value: string) {
    setSelected((prev) => {
      const current = prev[key] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      const out = { ...prev };
      if (next.length) out[key] = next;
      else delete out[key]; // drop empty keys so applyFilters stays cheap
      return out;
    });
  }

  const hasStructured = chips.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-2 items-start">
        {/* ---------------------------------------------- structured search */}
        <Card className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Search size={16} aria-hidden className="text-brand-purple" />
              <h2 className="font-display font-bold text-[17px] text-ink-1000">
                חיפוש לפי פרמטרים
              </h2>
            </div>
            <p className="t-body-sm text-ink-500 mt-1">
              בחרי פרמטר וסמני ערך אחד או יותר. אפשר לשלב כמה פרמטרים יחד.
            </p>
          </div>

          {catalogue.length === 0 ? (
            <p className="t-body-sm text-ink-500">אין כרגע פרמטרים זמינים לסינון.</p>
          ) : (
            <>
              <Field label="פרמטר" htmlFor="portal-param">
                <Select
                  id="portal-param"
                  value={activeKey}
                  onChange={(e) => {
                    setActiveKey(e.target.value);
                    setValueQuery("");
                  }}
                >
                  {catalogue.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                      {selected[f.key]?.length ? ` (${selected[f.key].length})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>

              {active && active.values.length > 8 && (
                <Input
                  type="search"
                  value={valueQuery}
                  onChange={(e) => setValueQuery(e.target.value)}
                  placeholder="סינון הערכים ברשימה…"
                  aria-label="סינון הערכים ברשימה"
                />
              )}

              <div
                className="max-h-64 overflow-y-auto rounded-sm border border-ink-200 bg-ink-50 p-2 flex flex-wrap gap-1.5"
                role="group"
                aria-label={active ? `ערכים עבור ${active.label}` : "ערכים"}
              >
                {visibleValues.length === 0 ? (
                  <p className="t-body-sm text-ink-500 p-2">אין ערכים תואמים.</p>
                ) : (
                  visibleValues.map((value) => {
                    const on = (selected[activeKey] ?? []).includes(value);
                    const count = counts.get(value) ?? 0;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggle(activeKey, value)}
                        aria-pressed={on}
                        className={[
                          "inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full text-xs font-semibold",
                          "transition-colors duration-150 border",
                          on
                            ? "bg-brand-pink-deep text-white border-brand-pink-deep"
                            : "bg-ink-0 text-ink-700 border-ink-200 hover:border-brand-purple",
                        ].join(" ")}
                      >
                        {value}
                        <span className={on ? "text-white/70" : "text-ink-400"}>{count}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </Card>

        {/* ----------------------------------------------- free-text search */}
        <Card className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} aria-hidden className="text-brand-pink-deep" />
              <h2 className="font-display font-bold text-[17px] text-ink-1000">חיפוש חופשי</h2>
            </div>
            <p className="t-body-sm text-ink-500 mt-1">
              כתבי מה את מחפשת במשפט אחד, ואנחנו נתרגם את זה לסינון.
            </p>
          </div>

          <form
            action={submitSmart}
            onSubmit={() => setSmartCleared(false)}
            className="flex flex-col gap-3"
          >
            <Textarea
              name="q"
              defaultValue={smart.status === "ok" ? smart.text : ""}
              rows={3}
              placeholder="מחפשים בוגרת בוטקאמפ עם React ואנגלית שוטפת"
              aria-label="תיאור המועמדת שאתן מחפשות"
            />
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={smartPending}>
                {smartPending ? "מחפשות…" : "חיפוש חכם"}
              </Button>
              {smartActive && (
                <Button type="button" variant="ghost" onClick={() => setSmartCleared(true)}>
                  ניקוי
                </Button>
              )}
            </div>
          </form>

          {smart.status === "error" && <Alert variant="warn">{smart.message}</Alert>}

          {smartActive && (
            <div className="rounded-sm bg-tint-purple p-3">
              <p className="t-body-sm text-ink-700">
                <span className="font-semibold text-brand-purple">כך הבנו את הבקשה: </span>
                {smart.interpretation || "לא זוהו פרמטרים מתוך המשפט."}
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* -------------------------------------------------- applied filters */}
      {hasStructured && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="t-caption">הסינון הפעיל:</span>
          {chips.map((chip) => (
            <button
              key={`${chip.key}:${chip.value}`}
              type="button"
              onClick={() => toggle(chip.key, chip.value)}
              className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full text-xs font-semibold bg-tint-pink text-brand-pink-deep hover:bg-brand-pink-deep hover:text-white transition-colors duration-150"
            >
              <span className="opacity-70">{chip.label}:</span>
              {chip.value}
              <X size={12} aria-hidden />
              <span className="sr-only">הסרת הסינון</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelected({})}
            className="t-caption underline underline-offset-2 hover:text-brand-pink-deep"
          >
            איפוס
          </button>
        </div>
      )}

      {/* ----------------------------------------------------------- results */}
      <div className="flex items-baseline justify-between gap-3 border-t border-ink-200 pt-4">
        <h2 className="font-display font-bold text-[17px] text-ink-1000">
          {results.length === 0
            ? "לא נמצאו מועמדות"
            : results.length === 1
              ? "נמצאה מועמדת אחת"
              : `נמצאו ${results.length} מועמדות`}
        </h2>
        {results.length !== candidates.length && (
          <span className="t-caption">מתוך {candidates.length}</span>
        )}
      </div>

      {results.length === 0 ? (
        <Card className="text-center py-10">
          <p className="font-display font-bold text-ink-900">אין מועמדות שמתאימות לסינון הזה.</p>
          <p className="t-body-sm text-ink-500 mt-1">
            אפשר להסיר כמה פרמטרים, או לנסח את החיפוש החופשי אחרת.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 list-none p-0 m-0">
          {results.map((c) => (
            <li key={c.id}>
              <Link href={`/portal/candidate/${c.id}`} className="block h-full no-underline">
                <Card interactive className="h-full flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar initials={c.initials} size="md" />
                    <div className="min-w-0">
                      <p className="font-display font-bold text-ink-1000 truncate">{c.name}</p>
                      {c.specialization && (
                        <p className="t-caption truncate">{c.specialization}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.region && <Badge variant="indigo">{c.region}</Badge>}
                    {c.isExperienced && <Badge variant="mint">בעלת ניסיון</Badge>}
                  </div>

                  {c.headline.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                      {c.headline.map((tech) => (
                        <Badge key={tech} variant="tech">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
