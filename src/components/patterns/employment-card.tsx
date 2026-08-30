"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Briefcase, HeartHandshake, MessageCircle } from "lucide-react";
import { Alert, Button, Field, Input, Switch } from "@/components/ui";
import { updateEmployment, type EmploymentState } from "@/app/(app)/profile/actions";

/**
 * "עדכון תעסוקה" — she tells us she found a job (workplace optional, shown
 * only to herself and the team). hired_via_us is pipeline-owned — here it only
 * earns her a celebratory gold badge. Mentor accompaniment is the admin's
 * call: when a mentor was assigned, the card shows her with a link to chat.
 */
export function EmploymentCard({
  foundJob,
  workplace,
  hiredViaUs,
  mentorName,
}: {
  foundJob: boolean;
  workplace: string | null;
  hiredViaUs: boolean;
  mentorName: string | null;
}) {
  const [on, setOn] = useState(foundJob);
  const [state, save, saving] = useActionState<EmploymentState, FormData>(updateEmployment, {});

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
          {saving ? "שומר…" : "שמירה"}
        </Button>
      </form>

      {mentorName && (
        <div className="border-t border-ink-100 pt-4 mt-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <HeartHandshake size={17} className="text-brand-pink-deep" />
            <h3 className="font-display text-[15.5px] font-bold text-ink-1000">
              המנטורית שלך לליווי: {mentorName} 👑
            </h3>
          </div>
          <p className="t-body-sm text-ink-700">
            היא מלווה אותך בחודשים הראשונים בתפקיד — שתהיה לך כתובת לכל שאלה 💜
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-purple hover:underline w-fit"
          >
            <MessageCircle size={14} /> לצ&apos;אט עם המנטורית
          </Link>
        </div>
      )}
    </div>
  );
}
