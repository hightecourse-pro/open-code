"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { submitToClientAndNotify } from "@/app/(admin)/admin/actions";

/**
 * ONE action for the step the owner could not find (25/9, the JAVA job):
 * send the approved candidates to the client AND tell every applicant where
 * she stands - "הגשנו אותך" to the ones sent, "התקדמנו עם מועמדות אחרות" to the
 * rest - and move the job to "בטיפול אצל הלקוח".
 */
export function JobSubmitButton({ jobId, approved, clientName }: { jobId: string; approved: number; clientName: string | null }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (result) return <Alert variant="success">{result}</Alert>;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {!open ? (
        <Button type="button" size="sm" onClick={() => setOpen(true)} disabled={approved === 0}>
          הגשה ללקוח + עדכון לכל המועמדות 📨
        </Button>
      ) : (
        <div className="rounded-[14px] border border-brand-purple/40 bg-tint-purple/40 p-3 flex flex-col gap-2">
          <div className="font-display font-bold text-[14px] text-ink-1000">מה יקרה בלחיצה אחת:</div>
          <ul className="text-[12.5px] text-ink-700 list-disc ps-5 flex flex-col gap-0.5">
            <li>
              {approved === 1 ? "המועמדת המאושרת" : `${approved} המועמדות המאושרות`} יישלחו ל{clientName ?? "לקוח"} במייל עם קישור לפורטל.
            </li>
            <li>כל אחת שנשלחה תקבל מייל ״הגשנו אותך״.</li>
            <li>כל השאר יקבלו מייל עדין: ״התקדמנו עם מועמדות אחרות״.</li>
            <li>המשרה תעבור ל״בטיפול אצל הלקוח״ ותיסגר להגשות חדשות.</li>
          </ul>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await submitToClientAndNotify(jobId);
                  if (r.error) setError(r.error);
                  else
                    setResult(
                      `נשלח ✓ הוגשו ${r.submitted} מועמדות ללקוח, נשלחו ${r.regrets} מיילי התקדמות לשאר. המשרה בטיפול אצל הלקוח.`
                    );
                })
              }
            >
              {pending ? "שולחת…" : "כן, לשלוח עכשיו"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              ביטול
            </Button>
          </div>
        </div>
      )}
      {approved === 0 && !open && (
        <span className="text-[11.5px] text-ink-500">קודם סמני ״אישור סופי״ למועמדות שמתאימות (בטאב מועמדות).</span>
      )}
    </div>
  );
}
