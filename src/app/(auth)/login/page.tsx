"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthState } from "../actions";
import { Alert, Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-h2">טוב לראות אותך שוב</h1>
        <p className="t-body-sm text-ink-500 mt-1">היכנסי כדי להמשיך לקהילה.</p>
      </div>

      {state.error && <Alert variant="danger">{state.error}</Alert>}

      <form action={action} className="flex flex-col gap-4">
        <Field label="אימייל" htmlFor="email">
          <Input id="email" name="email" type="email" required dir="ltr" autoComplete="email" />
        </Field>
        <Field label="סיסמה" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "רגע אחת…" : "כניסה"}
        </Button>
      </form>

      <p className="t-body-sm text-ink-500 text-center">
        עוד לא נרשמת?{" "}
        <Link href="/signup" className="font-semibold">
          להצטרפות לקהילה
        </Link>
      </p>
    </div>
  );
}
