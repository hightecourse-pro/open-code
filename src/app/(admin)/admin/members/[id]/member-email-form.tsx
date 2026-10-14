"use client";

import { useActionState } from "react";
import { setMemberEmail, type MemberEmailState } from "../../actions";
import { Alert, Button, Field, Input } from "@/components/ui";

/** ✉️ שינוי כתובת המייל של החשבון - by the team, from the member file (7/10 request). */
export function MemberEmailForm({ profileId, currentEmail }: { profileId: string; currentEmail: string | null }) {
  const [state, action, pending] = useActionState<MemberEmailState, FormData>(setMemberEmail.bind(null, profileId), {});
  return (
    <form action={action} className="flex flex-col gap-2">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">הכתובת הוחלפה ✓ מעכשיו היא נכנסת עם המייל החדש.</Alert>}
      <Field label={`כתובת חדשה (היום: ${currentEmail ?? "לא ידוע"})`} htmlFor="member-email">
        <Input id="member-email" name="email" type="email" dir="ltr" required placeholder="new@address.com" />
      </Field>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "מחליפה…" : "החלפת המייל"}
        </Button>
        <span className="text-[11.5px] text-ink-500">בלי מייל אימות - הכתובת החדשה נכנסת לתוקף מיד. אמרי לה.</span>
      </div>
    </form>
  );
}
