"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input } from "@/components/ui";
import { addKeyAction, type AddKeyState } from "@/app/(app)/ai/keys/actions";

export function AddKeyForm({ next }: { next?: string | null }) {
  const [state, action, pending] = useActionState<AddKeyState, FormData>(addKeyAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    // She came here from a tool that told her to add a key — take her back to
    // it the moment the key is verified, with a beat to read the ✓ first.
    if (next) {
      const t = setTimeout(() => router.push(next), 900);
      return () => clearTimeout(t);
    }
  }, [state.ok, next, router]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && (
        <Alert variant="success">
          המפתח נוסף ואומת מול Google ✓{next ? " מחזירה אותך לכלי…" : ""}
        </Alert>
      )}
      <Field label="שם לזיהוי (אופציונלי)" htmlFor="label">
        <Input id="label" name="label" placeholder="לדוגמה: המפתח הראשי שלי" />
      </Field>
      <Field label="מפתח Google API" htmlFor="key">
        <Input id="key" name="key" dir="ltr" placeholder="הדביקי כאן את המפתח מ-AI Studio" autoComplete="off" />
      </Field>
      <Button type="submit" disabled={pending} className="w-fit" bracketed>
        {pending ? "מאמת מול Google…" : "הוספת מפתח"}
      </Button>
    </form>
  );
}
