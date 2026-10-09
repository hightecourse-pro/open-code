"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";
import { setCourseTestAmount } from "./actions";

/**
 * Test mode for the payment page (the owner, 9/10): the amount Shufra's page
 * shows instead of the real price, changed from here - no deploy, no env.
 */
export function CourseSettingsForm({ amountOverride, envOverride }: { amountOverride: number | null; envOverride: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(amountOverride ? String(amountOverride) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const active = amountOverride ?? envOverride;

  function save(next: number | null) {
    setError(null);
    start(async () => {
      const r = await setCourseTestAmount(next);
      if (r.error) return setError(r.error);
      setValue(next ? String(next) : "");
      router.refresh();
    });
  }

  return (
    <div className={`rounded-[14px] border px-4 py-3 text-[13px] ${active ? "border-red-200 bg-red-50" : "border-ink-100 bg-white"}`}>
      {active ? (
        <p className="font-semibold text-red-800 leading-relaxed">
          ⚠️ מצב בדיקה: כל קישור תשלום שנבנה עכשיו מעביר לדף התשלום של שופרא עם סכום {active} ₪ במקום המחיר האמיתי (1,500 / 6,000).
          להחזיר למחיר האמיתי לפני שנרשמות אמיתיות משלמות.
        </p>
      ) : (
        <p className="font-semibold text-ink-900">סכום בדיקה לדף התשלום</p>
      )}
      <p className="text-[12.5px] text-ink-600 mt-1 leading-relaxed">
        לבדיקות עם כרטיס אמיתי בסכום סמלי: הסכום כאן נכנס לקישור התשלום (Amount) ודורס את הסכום של הדף השמור אצל שופרא, גם כשהוא
        נעול. החיוב אמיתי גם כשהוא 1 ₪. קוד ההרשמה בהערה מזהה את התשלום גם בסכום הזה.
        {envOverride && !amountOverride && <> כרגע הסכום מגיע מהגדרת הסביבה (COURSE_PAYMENT_AMOUNT_OVERRIDE={envOverride}); ערך שתשמרי כאן גובר עליה.</>}
      </p>
      {error && (
        <div className="mt-2">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}
      <form
        className="mt-2 flex items-center gap-2 flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseInt(value, 10);
          if (!Number.isFinite(n) || n < 1 || n > 20000) return setError("סכום בין 1 ל-20,000 ₪.");
          save(n);
        }}
      >
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={20000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="₪"
          aria-label="סכום בדיקה בשקלים"
          className="w-28"
          dir="ltr"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "שומרות…" : "להפעיל מצב בדיקה"}
        </Button>
        {amountOverride && (
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => save(null)}>
            חזרה למחיר האמיתי
          </Button>
        )}
      </form>
    </div>
  );
}
