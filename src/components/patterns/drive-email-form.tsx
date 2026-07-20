"use client";

import { useActionState } from "react";
import { HardDrive } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { setDriveEmail, type DriveEmailState } from "@/app/(app)/profile/actions";

/**
 * Google Drive can only share with a Google account. Members who signed up
 * with another address give us a Gmail here, and the material syncs to them
 * automatically within minutes.
 */
export function DriveEmailForm({
  current,
  loginEmail,
  wasRequested = false,
}: {
  current: string | null;
  loginEmail: string | null;
  wasRequested?: boolean;
}) {
  const [state, action, pending] = useActionState<DriveEmailState, FormData>(setDriveEmail, {});

  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <HardDrive size={17} className="text-brand-purple" />
        <h2 className="font-display text-lg font-bold text-ink-1000">כתובת לשיתוף חומרים</h2>
      </div>

      {wasRequested && !current && (
        <Alert variant="warn">
          כדי שנוכל לשתף איתך את הקלטות הסשנים וחומרי הקורסים, נשמח לכתובת Gmail —
          גוגל דרייב יודע לשתף רק עם חשבון Google.
        </Alert>
      )}

      <p className="t-body-sm text-ink-700">
        אנחנו משתפות את החומרים ב-Google Drive עם{" "}
        <span className="font-semibold text-ink-900" dir="ltr">
          {current || loginEmail || "כתובת ההתחברות שלך"}
        </span>
        . אם זו לא כתובת של חשבון Google, הוסיפי כאן כתובת Gmail והחומרים יגיעו אלייך תוך דקות.
      </p>

      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">נשמר ✓ החומרים ישותפו לכתובת הזו בקרוב.</Alert>}

      <form action={action} className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <Field label="כתובת Gmail (לא חובה)" htmlFor="drive_email" className="flex-1">
          <Input
            id="drive_email"
            name="drive_email"
            type="email"
            dir="ltr"
            autoComplete="email"
            placeholder="you@gmail.com"
            defaultValue={current ?? ""}
          />
        </Field>
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "שומר…" : "שמירה"}
        </Button>
      </form>
    </div>
  );
}
