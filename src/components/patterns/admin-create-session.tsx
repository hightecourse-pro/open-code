"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { createSession, type FormState } from "@/app/(admin)/admin/actions";

export function AdminCreateSession() {
  const [state, action, pending] = useActionState<FormState, FormData>(createSession, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">הסשן נוסף ✓</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="כותרת" htmlFor="s-title">
          <Input id="s-title" name="title" required />
        </Field>
        <Field label="נושא" htmlFor="s-topic">
          <Input id="s-topic" name="topic" placeholder="AI / DevOps / הכנה לראיונות" />
        </Field>
        <Field label="מועד" htmlFor="s-date">
          <Input id="s-date" name="scheduled_at" type="datetime-local" required dir="ltr" />
        </Field>
        <Field label="קישור Zoom" htmlFor="s-zoom">
          <Input id="s-zoom" name="zoom_url" dir="ltr" placeholder="https://zoom.us/…" />
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "מוסיף…" : "הוספת סשן"}
      </Button>
    </form>
  );
}
