"use client";

import { use, useActionState } from "react";
import { EmailInput } from "../email-input";
import Link from "next/link";
import { signIn, type AuthState } from "../actions";
import { Alert, Button, Field, PasswordInput } from "@/components/ui";
import { ClearSnapshots } from "@/components/patterns/stale-while-revalidate";

// A spent link means something different depending on which mail it came from,
// and "פג תוקף" on a confirmation she already completed reads like a bug.
const LINK_ERROR: Record<string, string> = {
  recovery:
    'הקישור לאיפוס הסיסמה כבר לא בתוקף (או שכבר השתמשת בו). בקשי קישור חדש דרך "שכחת סיסמה?" ונשלח לך אחד טרי 💌',
  signup:
    "נראה שכבר השתמשת בקישור האישור - כנראה שהכתובת שלך כבר מאושרת. פשוט היכנסי כאן עם המייל והסיסמה שלך.",
};
const LINK_ERROR_DEFAULT =
  'הקישור מהמייל כבר לא בתוקף (או שכבר השתמשת בו). אפשר להיכנס עם הסיסמה, או לבקש קישור חדש דרך "שכחת סיסמה?".';

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; type?: string; notice?: string }>;
}) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  // The auth handlers land here with ?error=auth when an email link is
  // expired or already used - without a message the failure is silent.
  const { error, type, notice } = use(searchParams);
  const linkError = error === "auth";
  const linkMessage = (type && LINK_ERROR[type]) || LINK_ERROR_DEFAULT;
  // The team-prepared email change (14/10): the confirmation link lands here.
  const emailChanged = notice === "email_changed";
  const emailChangeError =
    error === "email_change_taken"
      ? "הכתובת החדשה כבר שייכת לחשבון אחר - כתבי לנו ונסדר."
      : error === "email_change"
        ? "קישור האישור כבר לא בתוקף או לא תקין - כתבי לנו ונשלח חדש."
        : null;

  return (
    <>
      <ClearSnapshots />
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="t-h2">טוב לראות אותך שוב</h1>
          <p className="t-body-sm text-ink-500 mt-1">היכנסי כדי להמשיך לקהילה.</p>
        </div>

        {linkError && !state.error && <Alert variant="warn">{linkMessage}</Alert>}
        {emailChanged && !state.error && <Alert variant="success">הכתובת החדשה אושרה ✓ מעכשיו נכנסים איתה.</Alert>}
        {emailChangeError && !state.error && <Alert variant="warn">{emailChangeError}</Alert>}
        {state.error && <Alert variant="danger">{state.error}</Alert>}

        <form action={action} className="flex flex-col gap-4">
          <Field label="אימייל" htmlFor="email">
            <EmailInput id="email" name="email"  required dir="ltr" autoComplete="email" />
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
    </>
  );
}
