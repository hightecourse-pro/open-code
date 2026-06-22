"use client";

import { useActionState } from "react";
import { updatePassword, type AuthState } from "../actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-h2">בחירת סיסמה חדשה</h1>
        <p className="t-body-sm text-ink-500 mt-1">כמעט שם — בחרי סיסמה חדשה ונכניס אותך פנימה.</p>
      </div>

      {state.error && <Alert variant="danger">{state.error}</Alert>}

      <form action={action} className="flex flex-col gap-4">
        <Field label="סיסמה חדשה" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="לפחות 8 תווים"
          />
        </Field>
        <Field label="אימות סיסמה" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "שומר…" : "שמירת הסיסמה והמשך"}
        </Button>
      </form>
    </div>
  );
}
