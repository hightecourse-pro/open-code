"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthState } from "../actions";
import { Alert, Button, Field, Input, PasswordInput } from "@/components/ui";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  // The auth callback lands here with ?error=auth when an email link is
  // expired or already used — without a message the failure is silent.
  const linkError = use(searchParams).error === "auth";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="t-h2">טוב לראות אותך שוב</h1>
        <p className="t-body-sm text-ink-500 mt-1">היכנסי כדי להמשיך לקהילה.</p>
      </div>

      {linkError && !state.error && (
        <Alert variant="warn">
          הקישור מהמייל כבר לא בתוקף (או שכבר השתמשת בו). אפשר להיכנס עם הסיסמה, או לבקש קישור
          חדש דרך &quot;שכחת סיסמה?&quot;.
        </Alert>
      )}
      {state.error && <Alert variant="danger">{state.error}</Alert>}

      <form action={action} className="flex flex-col gap-4">
        <Field label="אימייל" htmlFor="email">
          <Input id="email" name="email" type="email" required dir="ltr" autoComplete="email" />
        </Field>
        <Field label="סיסמה" htmlFor="password">
          <PasswordInput id="password" name="password" required autoComplete="current-password" />
        </Field>
        <div className="-mt-1 text-left">
          <Link href="/forgot-password" className="t-body-sm text-brand-purple font-semibold">
            שכחת סיסמה?
          </Link>
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "רגע אחד…" : "כניסה"}
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
