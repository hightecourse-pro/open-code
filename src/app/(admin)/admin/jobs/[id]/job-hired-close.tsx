"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Checkbox } from "@/components/ui";
import { closeJobAsHired } from "@/app/(admin)/admin/actions";

export interface HireCandidate {
  applicationId: string;
  name: string;
  /** Current pipeline status label, e.g. "הוגשה ללקוח". */
  statusLabel: string;
  alreadyHired: boolean;
}

/**
 * Closing a job as hired asks WHO was hired (the owner, 23/9: עדינה טייטלבוים
 * was hired, the job was marked גויסה, and she never reached the hires list -
 * the job-level close never knew which candidate it was). Each ticked
 * candidate goes through the same path as "גויסה" in the review pane: her
 * application, her profile, the hires registry, the email - then the job
 * closes.
 */
export function JobHiredClose({ jobId, candidates }: { jobId: string; candidates: HireCandidate[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(candidates.filter((c) => c.alreadyHired).map((c) => c.applicationId)));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const newlyPicked = [...picked].filter((id) => !candidates.find((c) => c.applicationId === id)?.alreadyHired);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-full bg-brand-gradient text-white text-[12.5px] font-semibold px-3.5 py-1.5 hover:brightness-105 transition-[filter] cursor-pointer"
      >
        סימון המשרה כגויסה 🎉
      </button>
    );
  }

  return (
    <div className="w-full mt-2 rounded-[14px] border border-brand-purple/40 bg-tint-purple/40 p-3 flex flex-col gap-2">
      <div className="font-display font-bold text-[14px] text-ink-1000">מי גויסה למשרה? 🎉</div>
      <p className="text-[12px] text-ink-600 -mt-1">
        כל מי שתסמני תעבור לסטטוס ״גויסה״: הפרופיל שלה יסומן, היא תיכנס לרשימת הגיוסים ותקבל מייל. אחר כך המשרה תיסגר.
      </p>
      {candidates.length === 0 ? (
        <Alert variant="warn">
          אין למשרה הזו מועמדות שאפשר לסמן. אם מישהי גויסה מחוץ לרשימה - הוסיפי אותה במסך הגיוסים, ואז סגרי כאן.
        </Alert>
      ) : (
        <div className="flex flex-col gap-1">
          {candidates.map((c) => (
            <label key={c.applicationId} className="flex items-center gap-2 text-[13px] text-ink-900">
              <Checkbox
                checked={picked.has(c.applicationId)}
                disabled={c.alreadyHired || pending}
                onChange={(e) =>
                  setPicked((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(c.applicationId);
                    else n.delete(c.applicationId);
                    return n;
                  })
                }
                aria-label={`גויסה: ${c.name}`}
              />
              <span className="font-medium">{c.name}</span>
              <span className="text-[11.5px] text-ink-500">· {c.alreadyHired ? "כבר מסומנת כגויסה" : c.statusLabel}</span>
            </label>
          ))}
        </div>
      )}
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await closeJobAsHired(jobId, newlyPicked);
              if (res.error) setError(res.error);
            })
          }
        >
          {pending
            ? "מעדכנת…"
            : newlyPicked.length > 0
              ? `סימון ${newlyPicked.length === 1 ? "מועמדת אחת" : `${newlyPicked.length} מועמדות`} כגויסו וסגירת המשרה`
              : "סגירת המשרה כגויסה"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          ביטול
        </Button>
      </div>
    </div>
  );
}
