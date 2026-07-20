"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { createJob, type FormState } from "@/app/(admin)/admin/actions";

const EMPLOYMENT: { value: string; label: string }[] = [
  { value: "full", label: "משרה מלאה" },
  { value: "part", label: "משרה חלקית" },
  { value: "student", label: "משרת סטודנטית" },
  { value: "freelance", label: "פרילנס" },
];

export function AdminCreateJob() {
  const [state, action, pending] = useActionState<FormState, FormData>(createJob, {});
  const [source, setSource] = useState("open");

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">המשרה נוספה ✓</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="חברה" htmlFor="j-company">
          <Input id="j-company" name="company" required />
        </Field>
        <Field label="תפקיד" htmlFor="j-title">
          <Input id="j-title" name="title" required />
        </Field>
        <Field label="סוג משרה" htmlFor="j-source">
          <Select id="j-source" name="source" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="ours">משרה שלנו (הגשה פנימית)</option>
            <option value="open">משרה מהשוק (הגשה חיצונית)</option>
          </Select>
        </Field>
        <Field label="היקף" htmlFor="j-emp">
          <Select id="j-emp" name="employment_type" defaultValue="full">
            {EMPLOYMENT.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="מיקום" htmlFor="j-location">
          <Input id="j-location" name="location" placeholder="תל אביב / מרחוק" />
        </Field>
      </div>
      <Field label="טכנולוגיות (מופרדות בפסיק)" htmlFor="j-tech">
        <Input id="j-tech" name="tech" placeholder="react, nodejs, sql" dir="ltr" />
      </Field>
      <Field
        label={source === "open" ? "קישור להגשה (חובה)" : "קישור להגשה חיצונית (לא חובה)"}
        htmlFor="j-url"
      >
        <Input
          id="j-url"
          name="external_url"
          dir="ltr"
          required={source === "open"}
          placeholder="https://…"
        />
      </Field>
      <Field label="תיאור" htmlFor="j-desc">
        <Textarea id="j-desc" name="description" />
      </Field>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "מוסיף…" : "הוספת משרה"}
      </Button>
    </form>
  );
}
