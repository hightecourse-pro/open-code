"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthState } from "../actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-h2">ברוכה הבאה לקוד פתוח</h1>
        <p className="t-body-sm text-ink-500 mt-1">אנחנו שמחות שאת פה.</p>
      </div>

      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.message && <Alert variant="success">{state.message}</Alert>}

      {!state.message && (
        <form action={action} className="flex flex-col gap-4">
          <Field label="שם מלא" htmlFor="full_name">
            <Input id="full_name" name="full_name" required autoComplete="name" />
          </Field>
          <Field label="אימייל" htmlFor="email">
            <Input id="email" name="email" type="email" required dir="ltr" autoComplete="email" />
          </Field>
          <Field label="סיסמה" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
            />
          </Field>
          <Button type="submit" disabled={pending} className="w-full" bracketed>
            {pending ? "רגע אחת…" : "הצטרפות"}
          </Button>
        </form>
      )}

      <p className="t-body-sm text-ink-500 text-center">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="font-semibold">
          לכניסה
        </Link>
      </p>
    </div>
  );
}
