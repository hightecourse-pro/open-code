"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { updateFeedbackLabels, type PricingState } from "@/app/(admin)/admin/actions";
import type { FeedbackAspect } from "@/lib/feedback-questions";

/**
 * The wording of the four session-feedback rating questions — the admin's to
 * phrase (the slots themselves are fixed). What she saves here is what the
 * "היית איתנו בסשן?" banner asks every member.
 */
export function FeedbackQuestionsForm({ aspects }: { aspects: FeedbackAspect[] }) {
  const [state, action, pending] = useActionState<PricingState, FormData>(updateFeedbackLabels, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">שאלות המשוב עודכנו ✓ מהמשוב הבא כולן יראו אותן.</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {aspects.map((a, i) => (
          <Field key={a.name} label={`שאלת דירוג ${i + 1}`} htmlFor={`fq-${a.name}`}>
            <Input id={`fq-${a.name}`} name={a.name} defaultValue={a.label} maxLength={80} />
          </Field>
        ))}
      </div>
      <p className="text-[12.5px] text-ink-500 -mt-1">
        כל שאלה מדורגת 1–5 כוכבים במשוב על סשן. השארת שדה ריק מחזירה את הנוסח המקורי.
      </p>

      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        {pending ? "שומר…" : "שמירת שאלות המשוב"}
      </Button>
    </form>
  );
}
