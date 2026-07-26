"use client";

import { useActionState, useState } from "react";
import { Briefcase, HeartHandshake } from "lucide-react";
import { Alert, Button, Field, Input, Switch, Textarea } from "@/components/ui";
import {
  requestEmploymentMentor,
  updateEmployment,
  type EmploymentMentorState,
  type EmploymentState,
} from "@/app/(app)/profile/actions";

/**
 * "עדכון תעסוקה" — she tells us she found a job (workplace optional), and once
 * she has one we offer mentor accompaniment for the first months. hired_via_us
 * is pipeline-owned — here it only earns her a celebratory gold badge.
 */
export function EmploymentCard({
  foundJob,
  workplace,
  hiredViaUs,
  hasOpenEmploymentRequest,
}: {
  foundJob: boolean;
  workplace: string | null;
  hiredViaUs: boolean;
  hasOpenEmploymentRequest: boolean;
}) {
  const [on, setOn] = useState(foundJob);
  const [state, save, saving] = useActionState<EmploymentState, FormData>(updateEmployment, {});
  const [mentorState, requestMentor, requesting] = useActionState<EmploymentMentorState, FormData>(
    requestEmploymentMentor,
    {}
  );

  const requestReceived = hasOpenEmploymentRequest || !!mentorState.ok;

  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Briefcase size={17} className="text-brand-purple" />
        <h2 className="font-display text-lg font-bold text-ink-1000">עדכון תעסוקה 💼</h2>
      </div>

      {hiredViaUs && (
        <span className="self-start inline-flex items-center gap-1.5 text-[13px] font-bold text-crown-gold bg-tint-warm border border-crown-gold-soft px-3.5 py-1.5 rounded-full">
          🎉 המשרה נמצאה דרך קוד פתוח 💜
        </span>
      )}

      <p className="t-body-sm text-ink-700">
        מצאת עבודה? ספרי לנו — זה עוזר לנו לדייק את המשרות, וגם פשוט לשמוח איתך 🎉
      </p>

      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">{on ? "עודכן ✓ מזל טוב! 🎉" : "עודכן ✓"}</Alert>}

      <form action={save} className="flex flex-col gap-3">
        <Switch
          name="found_job"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          label={<span className="font-semibold text-ink-900">מצאתי עבודה!</span>}
        />
        {on && (
          <Field label="מקום העבודה (לא חובה)" htmlFor="workplace">
            <Input
              id="workplace"
              name="workplace"
              defaultValue={workplace ?? ""}
              placeholder="שם החברה"
            />
          </Field>
        )}
        <Button type="submit" size="sm" disabled={saving} className="w-fit">
          {saving ? "שומרות…" : "שמירה"}
        </Button>
      </form>

      {on && (
        <div className="border-t border-ink-100 pt-4 mt-1 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <HeartHandshake size={17} className="text-brand-pink-deep" />
            <h3 className="font-display text-[15.5px] font-bold text-ink-1000">
              מתחילה עבודה חדשה? מגיע לך ליווי 💜
            </h3>
          </div>
          <p className="t-body-sm text-ink-700">
            מנטורית מנוסה תלווה אותך בחודשים הראשונים בתפקיד — שתהיה לך כתובת לכל שאלה.
          </p>

          {requestReceived ? (
            <Alert variant="success">
              {mentorState.ok && !mentorState.already
                ? "הבקשה נשלחה 💜 נצוות לך מנטורית ונעדכן אותך במייל."
                : "כבר קיבלנו את הבקשה שלך — מטפלות בה 💜"}
            </Alert>
          ) : (
            <>
              {mentorState.error && <Alert variant="danger">{mentorState.error}</Alert>}
              <form action={requestMentor} className="flex flex-col gap-3">
                <Field label="מה היית רוצה מהליווי? (בקשות מיוחדות)" htmlFor="mentor_note">
                  <Textarea
                    id="mentor_note"
                    name="note"
                    rows={3}
                    placeholder="לא חובה — אפשר גם לשלוח כמו שזה"
                  />
                </Field>
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={requesting}
                  className="w-fit"
                >
                  {requesting ? "שולחות…" : "אשמח לליווי 💜"}
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
