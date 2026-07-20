"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Field, Input } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import {
  addSystemKeyAction,
  deleteSystemKeyAction,
  reviveSystemKeyAction,
  type AddSystemKeyState,
} from "./actions";

/** One day in the usage window, pre-formatted on the server to keep locales identical. */
export interface UsageDay {
  day: string;
  weekday: string;
  label: string;
  calls: number;
  errors: number;
  isToday: boolean;
}

export interface SystemKeyCardData {
  id: string;
  label: string | null;
  key_last4: string | null;
  status: string;
  last_error: string | null;
  last_used_at: string | null;
  /** Oldest → newest, so RTL reading order runs backwards in time. */
  days: UsageDay[];
}

const STATUS: Record<string, { label: string; variant: "mint" | "warm" | "pink" | "tech" }> = {
  active: { label: "פעיל", variant: "mint" },
  exhausted: { label: "נגמרה המכסה", variant: "warm" },
  invalid: { label: "לא תקין", variant: "pink" },
};

export function AddSystemKeyForm() {
  const [state, action, pending] = useActionState<AddSystemKeyState, FormData>(
    addSystemKeyAction,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">המפתח נוסף לבריכה ✓</Alert>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="שם לזיהוי (אופציונלי)" htmlFor="label">
          <Input id="label" name="label" placeholder="לדוגמה: מפתח קהילה 1" />
        </Field>
        <Field label="מפתח Google API" htmlFor="key">
          <Input
            id="key"
            name="key"
            dir="ltr"
            autoComplete="off"
            placeholder="הדביקי כאן את המפתח מ-AI Studio"
          />
        </Field>
      </div>

      <Button type="submit" disabled={pending} className="w-fit" bracketed>
        {pending ? "שומרת…" : "הוספת מפתח"}
      </Button>
    </form>
  );
}

/** A 7-day strip: bar per day, errors stacked in red on top of successful calls. */
function UsageStrip({ days }: { days: UsageDay[] }) {
  const peak = Math.max(1, ...days.map((d) => d.calls));
  const total = days.reduce((sum, d) => sum + d.calls, 0);
  const totalErrors = days.reduce((sum, d) => sum + d.errors, 0);

  return (
    <div className="bg-ink-50 border border-ink-100 rounded-sm p-3">
      <div className="flex items-baseline justify-between gap-2 mb-2.5">
        <span className="text-[11px] font-semibold text-ink-700">7 הימים האחרונים</span>
        <span className="text-[11px] text-ink-500 tabular-nums">
          {total} קריאות
          {totalErrors > 0 && <span className="text-danger"> · {totalErrors} שגיאות</span>}
        </span>
      </div>

      <div className="flex items-end gap-1.5">
        {days.map((d) => {
          const ok = d.calls - d.errors;
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={`${d.label}: ${d.calls} קריאות, ${d.errors} שגיאות`}>
              <span className="text-[10.5px] text-ink-500 tabular-nums leading-none">
                {d.calls}
              </span>

              <div className="w-full h-9 flex flex-col justify-end" aria-hidden>
                {d.calls === 0 ? (
                  <div className="w-full h-[2px] rounded-full bg-ink-200" />
                ) : (
                  <div className="w-full flex flex-col justify-end rounded-[3px] overflow-hidden">
                    {d.errors > 0 && (
                      <div
                        className="w-full bg-danger"
                        style={{ height: `${Math.max(2, (d.errors / peak) * 36)}px` }}
                      />
                    )}
                    {ok > 0 && (
                      <div
                        className="w-full bg-brand-purple"
                        style={{ height: `${Math.max(2, (ok / peak) * 36)}px` }}
                      />
                    )}
                  </div>
                )}
              </div>

              <span
                className={
                  d.isToday
                    ? "text-[10.5px] font-bold text-brand-pink-deep leading-none"
                    : "text-[10.5px] text-ink-500 leading-none"
                }
              >
                {d.weekday}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SystemKeyCard({ keyData }: { keyData: SystemKeyCardData }) {
  const [pending, start] = useTransition();
  const status = STATUS[keyData.status] ?? { label: keyData.status, variant: "tech" as const };
  const needsRevival = keyData.status !== "active";

  return (
    <div className="border border-ink-200 rounded-[18px] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-ink-900">{keyData.label || "מפתח ללא שם"}</span>
            <Badge variant={status.variant} dot>
              {status.label}
            </Badge>
          </div>
          <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <code dir="ltr" className="font-mono text-ink-700">
              ••••{keyData.key_last4 ?? "????"}
            </code>
            <span>
              ·{" "}
              {keyData.last_used_at
                ? `בשימוש אחרון ${timeAgo(keyData.last_used_at)}`
                : "טרם היה בשימוש"}
            </span>
          </div>
        </div>

        <div className="flex gap-1.5 items-center">
          {needsRevival && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => start(() => void reviveSystemKeyAction(keyData.id))}
            >
              <RotateCcw size={14} />
              החזרה לשימוש
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            className="text-danger hover:bg-danger-bg"
            onClick={() => {
              if (
                window.confirm(
                  `למחוק את המפתח "${keyData.label || `••••${keyData.key_last4 ?? ""}`}"? החיפוש החכם בפורטל יפסיק להשתמש בו.`
                )
              ) {
                start(() => void deleteSystemKeyAction(keyData.id));
              }
            }}
          >
            <Trash2 size={14} />
            מחיקה
          </Button>
        </div>
      </div>

      {keyData.last_error && (
        <p className="text-xs text-danger">שגיאה אחרונה: {keyData.last_error}</p>
      )}

      <UsageStrip days={keyData.days} />
    </div>
  );
}
