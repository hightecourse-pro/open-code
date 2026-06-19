"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthState } from "../actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-h2">שכחת סיסמה?</h1>
        <p className="t-body-sm text-ink-500 mt-1">אין בעיה — נשלח לך קישור לאיפוס במייל.</p>
      </div>

      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.message && <Alert variant="success">{state.message}</Alert>}

      {!state.message && (
        <form action={action} className="flex flex-col gap-4">
          <Field label="אימייל" htmlFor="email">
            <Input id="email" name="email" type="email" required dir="ltr" autoComplete="email" />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "שולחות…" : "שליחת קישור לאיפוס"}
          </Button>
        </form>
      )}

      <p className="t-body-sm text-ink-500 text-center">
        <Link href="/login" className="font-semibold">
          חזרה לכניסה
        </Link>
      </p>
    </div>
  );
}
