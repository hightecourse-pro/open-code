"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { requestCoordinatorOtp, verifyCoordinatorOtp, type OtpState } from "../actions";

/** Two steps in one card: email → 6-digit code from the email. */
export function CoordinatorLoginForm() {
  const [reqState, requestAction, requesting] = useActionState<OtpState, FormData>(
    requestCoordinatorOtp,
    {}
  );
  const [verState, verifyAction, verifying] = useActionState<OtpState, FormData>(
    verifyCoordinatorOtp,
    {}
  );

  const email = verState.email ?? reqState.email ?? "";
  const codeStage = reqState.sent === true || verState.sent === true;

  if (!codeStage) {
    return (
      <form action={requestAction} className="flex flex-col gap-3">
        {reqState.error && <Alert variant="danger">{reqState.error}</Alert>}
        <Field label="המייל שלך" htmlFor="coord-email">
          <Input
            id="coord-email"
            name="email"
            type="email"
            dir="ltr"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </Field>
        <Button type="submit" disabled={requesting}>
          {requesting ? "שולח קוד…" : "שליחת קוד כניסה"}
        </Button>
      </form>
    );
  }

  return (
    <form action={verifyAction} className="flex flex-col gap-3">
      {verState.error ? (
        <Alert variant="danger">{verState.error}</Alert>
      ) : (
        <Alert variant="success">
          אם הכתובת מוכרת לנו - קוד בן 6 ספרות בדרך למייל. תקף ל-10 דקות.
        </Alert>
      )}
      <input type="hidden" name="email" value={email} />
      <Field label={`הקוד שנשלח ל-${email}`} htmlFor="coord-code">
        <Input
          id="coord-code"
          name="code"
          inputMode="numeric"
          dir="ltr"
          required
          maxLength={6}
          autoComplete="one-time-code"
          className="text-center tracking-[6px] font-bold text-lg"
          placeholder="••••••"
        />
      </Field>
      <Button type="submit" disabled={verifying}>
        {verifying ? "נכנסת…" : "כניסה"}
      </Button>
      <button
        type="submit"
        formAction={requestAction}
        disabled={requesting}
        className="text-[12.5px] font-semibold text-brand-purple hover:underline cursor-pointer w-fit"
      >
        {requesting ? "שולח…" : "שליחת קוד חדש"}
      </button>
    </form>
  );
}
