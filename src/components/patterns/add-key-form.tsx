"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { addKeyAction, type AddKeyState } from "@/app/(app)/ai/keys/actions";

export function AddKeyForm() {
  const [state, action, pending] = useActionState<AddKeyState, FormData>(addKeyAction, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">המפתח נוסף ואומת מול Google ✓</Alert>}
      <Field label="שם לזיהוי (אופציונלי)" htmlFor="label">
        <Input id="label" name="label" placeholder="לדוגמה: המפתח של גוגל הראשי" />
      </Field>
      <Field label="מפתח Google API" htmlFor="key">
        <Input id="key" name="key" dir="ltr" placeholder="AIza…" autoComplete="off" />
      </Field>
      <Button type="submit" disabled={pending} className="w-fit" bracketed>
        {pending ? "מאמת מול Google…" : "הוספת מפתח"}
      </Button>
    </form>
  );
}
