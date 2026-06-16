"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { createJob, type FormState } from "@/app/(admin)/admin/actions";

export function AdminCreateJob() {
  const [state, action, pending] = useActionState<FormState, FormData>(createJob, {});

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
        <Field label="סוג" htmlFor="j-source">
          <Select id="j-source" name="source" defaultValue="open">
            <option value="ours">משרה שלנו</option>
            <option value="open">משרה פתוחה</option>
          </Select>
        </Field>
        <Field label="מיקום" htmlFor="j-location">
          <Input id="j-location" name="location" placeholder="תל אביב / מרחוק" />
        </Field>
      </div>
      <Field label="טכנולוגיות (מופרדות בפסיק)" htmlFor="j-tech">
        <Input id="j-tech" name="tech" placeholder="react, nodejs, sql" dir="ltr" />
      </Field>
      <Field label="קישור להגשה חיצונית (למשרה פתוחה)" htmlFor="j-url">
        <Input id="j-url" name="external_url" dir="ltr" placeholder="https://…" />
      </Field>
      <Field label="תיאור" htmlFor="j-desc">
        <Textarea id="j-desc" name="description" />
      </Field>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "מוסיפה…" : "הוספת משרה"}
      </Button>
    </form>
  );
}
