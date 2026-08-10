"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Checkbox, Field, Input, Select, Switch } from "@/components/ui";
import {
  assignEmploymentMentor,
  setMemberEmployment,
  type FormState,
} from "@/app/(admin)/admin/actions";

/**
 * Admin-editable employment status for a member — including retroactive
 * "גויסה דרך קוד פתוח" marking. Clearing "מצאה עבודה" clears everything
 * (hired_via_us, workplace, hired_at) server-side.
 */
export function MemberEmploymentForm({
  profileId,
  foundJob,
  hiredViaUs,
  workplace,
  hiredAtDate,
}: {
  profileId: string;
  foundJob: boolean;
  hiredViaUs: boolean;
  workplace: string | null;
  /** yyyy-mm-dd — existing hired_at or today, computed server-side. */
  hiredAtDate: string;
}) {
  const [on, setOn] = useState(foundJob);
  const [state, save, saving] = useActionState<FormState, FormData>(
    setMemberEmployment.bind(null, profileId),
    {}
  );

  return (
    <form action={save} className="flex flex-col gap-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">עודכן ✓</Alert>}

      <Switch
        name="found_job"
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        label={<span className="font-semibold text-ink-900">מצאה עבודה</span>}
      />
      {on && (
        <>
          <Checkbox
            name="hired_via_us"
            defaultChecked={hiredViaUs}
            label={<span className="font-semibold text-ink-900">גויסה דרך קוד פתוח 🎉</span>}
          />
          <div className="flex gap-3 flex-wrap">
            <Field label="מקום עבודה (פנימי)" htmlFor="emp_workplace" className="w-56 max-w-full">
              <Input
                id="emp_workplace"
                name="workplace"
                defaultValue={workplace ?? ""}
                placeholder="שם החברה"
              />
            </Field>
            <Field label="מתי" htmlFor="emp_hired_at" className="w-44 max-w-full">
              <Input id="emp_hired_at" name="hired_at" type="date" defaultValue={hiredAtDate} />
            </Field>
          </div>
        </>
      )}
      <Button type="submit" size="sm" disabled={saving} className="w-fit">
        {saving ? "שומרות…" : "שמירה"}
      </Button>
    </form>
  );
}

/**
 * Employment accompaniment is the admin's call — pick an active mentor to
 * accompany the member in her first months on the job.
 */
export function EmploymentMentorAssign({
  profileId,
  mentors,
  assignedMentorName,
}: {
  profileId: string;
  mentors: { id: string; full_name: string }[];
  assignedMentorName: string | null;
}) {
  const [state, assign, assigning] = useActionState<FormState, FormData>(
    assignEmploymentMentor.bind(null, profileId),
    {}
  );

  return (
    <div className="flex flex-col gap-2">
      {assignedMentorName && (
        <span className="text-[13px] font-semibold text-[#8C5E0E]">
          מלווה כרגע: 👑 {assignedMentorName}
        </span>
      )}
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">שויכה ✓ החברה עודכנה במייל 💜</Alert>}

      {mentors.length > 0 ? (
        <form action={assign} className="flex items-center gap-2 flex-wrap">
          <div className="w-56 max-w-full">
            <Select name="mentor_id" required defaultValue="" className="!py-2 text-[13px]">
              <option value="" disabled>
                בחירת מנטורית לליווי…
              </option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" size="sm" disabled={assigning}>
            {assigning ? "משייכות…" : "שיוך מנטורית 👑"}
          </Button>
        </form>
      ) : (
        <span className="text-[12px] text-ink-500">אין כרגע מנטוריות פעילות לשיוך.</span>
      )}
    </div>
  );
}
