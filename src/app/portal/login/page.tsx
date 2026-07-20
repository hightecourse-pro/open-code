"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Logo, PasswordInput } from "@/components/ui";
import { portalLogin, type PortalAuthState } from "../actions";

export default function PortalLoginPage() {
  const [state, action, pending] = useActionState<PortalAuthState, FormData>(portalLogin, {});

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-1000 px-6 py-12">
      {/* A single, very restrained brand wash — enough to feel branded, not warm. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-[0.18] bg-[radial-gradient(60%_60%_at_50%_0%,#464CA0_0%,transparent_70%)]"
      />

      <div className="relative w-full max-w-[420px]">
        <div className="rounded-lg border border-ink-200 bg-ink-0 p-8 shadow-xl sm:p-10">
          <div className="flex flex-col items-center text-center">
            <Logo width={132} priority />
            <p className="t-micro mt-3">פורטל מועמדות · קוד פתוח</p>
          </div>

          <div className="mt-7">
            <h1 className="t-h3">התחברו לפורטל</h1>
            <p className="t-body-sm mt-1">
              הזינו את פרטי הגישה שקיבלתם כדי לצפות בפרופילים המתאימים למשרות שלכם.
            </p>
          </div>

          {state.error && (
            <div className="mt-5">
              <Alert variant="danger">{state.error}</Alert>
            </div>
          )}

          <form action={action} className="mt-6 flex flex-col gap-4">
            <Field label="שם משתמש" htmlFor="username">
              <Input
                id="username"
                name="username"
                type="text"
                required
                dir="ltr"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </Field>

            <Field label="סיסמה" htmlFor="password">
              <PasswordInput id="password" name="password" required autoComplete="current-password" />
            </Field>

            <Button
              type="submit"
              variant="pill"
              disabled={pending}
              className="mt-1 w-full rounded-sm py-3"
            >
              {pending ? "מתחברים…" : "התחברות"}
            </Button>
          </form>
        </div>

        <p className="t-caption mt-5 text-center text-white/45">
          הגישה לפורטל ניתנת על ידי קוד פתוח. לקבלת פרטי גישה או לאיפוס סיסמה — פנו אלינו.
        </p>
      </div>
    </main>
  );
}
