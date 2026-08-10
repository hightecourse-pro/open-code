"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { addManualHire, deleteManualHire, type FormState } from "@/app/(admin)/admin/actions";

export interface ManualHireRow {
  id: string;
  full_name: string;
  hired_at: string;
}

/**
 * Admin CRUD for off-community placements — women hired via Open Code without
 * being members. Only the name reaches the forum's celebration banner (for the
 * 60-day window from the chosen date).
 */
export function ManualHiresCard({
  hires,
  defaultDate,
}: {
  hires: ManualHireRow[];
  /** yyyy-mm-dd, computed server-side to avoid hydration drift. */
  defaultDate: string;
}) {
  const [state, add, adding] = useActionState<FormState, FormData>(addManualHire, {});

  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-3">
      <h3 className="font-display text-base font-bold">🎉 מגויסות מחוץ לקהילה (לבאנר)</h3>
      <p className="text-[12.5px] text-ink-500">
        נשים שמצאו עבודה דרכנו בלי להיות חברות קהילה — השם (בלבד) יופיע בבאנר החגיגי בפורום
        למשך 60 יום מהתאריך.
      </p>

      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">נוספה לבאנר 🎉</Alert>}

      <form action={add} className="flex items-end gap-2 flex-wrap">
        <Field label="שם מלא" htmlFor="mh_name" className="w-56 max-w-full">
          <Input id="mh_name" name="full_name" required placeholder="שם מלא" />
        </Field>
        <Field label="מתי התחילה" htmlFor="mh_date" className="w-44 max-w-full">
          <Input id="mh_date" name="hired_at" type="date" defaultValue={defaultDate} />
        </Field>
        <Button type="submit" size="sm" disabled={adding}>
          {adding ? "מוסיפות…" : "הוספה"}
        </Button>
      </form>

      {hires.length > 0 && (
        <div className="flex flex-col">
          {hires.map((h) => (
            <div
              key={h.id}
              className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-b-0"
            >
              <span className="font-medium text-ink-900">{h.full_name}</span>
              <span className="text-[12px] text-ink-500">
                {new Date(h.hired_at).toLocaleDateString("he-IL")}
              </span>
              <form action={deleteManualHire.bind(null, h.id)} className="ms-auto">
                <Button type="submit" size="sm" variant="ghost">
                  הסרה
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
