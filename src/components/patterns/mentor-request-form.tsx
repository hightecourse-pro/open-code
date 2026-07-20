"use client";

import { useActionState } from "react";
import { Crown, Check } from "lucide-react";
import { Alert, Button, Field, Select, Textarea } from "@/components/ui";
import { requestMentor, type MentorRequestState } from "@/app/(app)/mentor/actions";
import { MENTOR_REQUEST_REASONS } from "@/lib/mentor-requests";

/**
 * Shown to a member who isn't matched with a mentor yet: she picks what she
 * needs help with, optionally writes a few words, and the team gets it.
 */
export function MentorRequestForm({ pendingRequest = false }: { pendingRequest?: boolean }) {
  const [state, action, pending] = useActionState<MentorRequestState, FormData>(requestMentor, {});

  if (pendingRequest || state.ok) {
    return (
      <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex items-start gap-3">
        <span className="w-9 h-9 rounded-full bg-tint-mint flex items-center justify-center shrink-0 text-[#1B7A4B]">
          <Check size={18} />
        </span>
        <div>
          <div className="font-display font-bold text-ink-1000">הבקשה שלך אצלנו 💜</div>
          <p className="t-body-sm text-ink-700 mt-0.5">
            נחפש לך את המנטורית שהכי מתאימה ונחזור אלייך במייל. זה בדרך כלל לוקח כמה ימים.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-brand-gradient-soft flex items-center justify-center shrink-0 text-brand-pink-deep">
          <Crown size={19} />
        </span>
        <div>
          <div className="font-display font-bold text-ink-1000">עדיין לא חיברנו לך מנטורית</div>
          <p className="t-body-sm text-ink-700 mt-0.5">את יכולה לבקש כאן — ונמצא לך את ההתאמה הנכונה.</p>
        </div>
      </div>

      {state.error && <Alert variant="danger">{state.error}</Alert>}

      <form action={action} className="flex flex-col gap-3.5">
        <Field label="במה נוכל לעזור לך?" htmlFor="mr-reason">
          <Select id="mr-reason" name="reason" defaultValue="" required>
            <option value="">בחרי…</option>
            {MENTOR_REQUEST_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="רוצה להוסיף משהו? (לא חובה)" htmlFor="mr-note">
          <Textarea
            id="mr-note"
            name="note"
            rows={3}
            maxLength={1000}
            placeholder="כמה מילים שיעזרו לנו למצוא לך את המנטורית המתאימה…"
          />
        </Field>

        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "שולח…" : "שליחת בקשה למנטורית"}
        </Button>
      </form>
    </div>
  );
}
