"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { addManualHire, deleteManualHire, type FormState } from "@/app/(admin)/admin/actions";

export interface ManualHireRow {
  id: string;
  full_name: string;
  hired_at: string;
  email: string | null;
  company: string | null;
  job_type: string | null;
  profile_id: string | null;
}

const JOB_TYPE_HE: Record<string, string> = {
  practicum_placement: "פרקטיקום ולאחריו השמה",
  temp: "משרה זמנית",
  immediate: "השמה מיידית",
};

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
        <Field label="שם מלא" htmlFor="mh_name" className="w-48 max-w-full">
          <Input id="mh_name" name="full_name" required placeholder="שם מלא" />
        </Field>
        <Field label="מייל" htmlFor="mh_email" className="w-52 max-w-full">
          <Input id="mh_email" name="email" type="email" dir="ltr" placeholder="email@example.com" />
        </Field>
        <Field label="חברה" htmlFor="mh_company" className="w-44 max-w-full">
          <Input id="mh_company" name="company" placeholder="שם החברה" />
        </Field>
        <Field label="סוג משרה" htmlFor="mh_type" className="w-48 max-w-full">
          <select
            id="mh_type"
            name="job_type"
            className="w-full h-10 border border-ink-300 rounded-md px-2.5 text-sm bg-white"
            defaultValue=""
          >
            <option value="">— לא צוין —</option>
            <option value="practicum_placement">פרקטיקום ולאחריו השמה</option>
            <option value="temp">משרה זמנית</option>
            <option value="immediate">השמה מיידית</option>
          </select>
        </Field>
        <Field label="מתי התחילה" htmlFor="mh_date" className="w-40 max-w-full">
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
              className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-b-0 flex-wrap"
            >
              {h.profile_id ? (
                <a
                  href={`/admin/members/${h.profile_id}`}
                  className="font-medium text-ink-900 hover:text-brand-purple hover:underline"
                >
                  {h.full_name}
                </a>
              ) : (
                <span className="font-medium text-ink-900">{h.full_name}</span>
              )}
              {h.profile_id && (
                <span className="text-[10.5px] font-bold bg-tint-purple text-brand-purple px-2 py-0.5 rounded-full">
                  בקהילה
                </span>
              )}
              {h.company && <span className="text-[12px] text-ink-700">{h.company}</span>}
              {h.job_type && JOB_TYPE_HE[h.job_type] && (
                <span className="text-[11px] font-bold bg-tint-warm text-[#8C5E0E] px-2 py-0.5 rounded-full">
                  {JOB_TYPE_HE[h.job_type]}
                </span>
              )}
              {h.email && (
                <span className="font-mono text-[11px] text-ink-400" dir="ltr">{h.email}</span>
              )}
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
