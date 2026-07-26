"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Textarea } from "@/components/ui";
import { sendJobCandidatesToClient } from "@/app/(admin)/admin/actions";

/**
 * Emails the linked client the curated candidates for this job (with the
 * portal credentials), behind an inline confirm panel — the send is final, so
 * no one-click accidents. An optional personal note is woven into the email.
 */
export function SendCandidatesButton({
  jobId,
  clientName,
}: {
  jobId: string;
  clientName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  function send() {
    setResult(null);
    start(async () => {
      const r = await sendJobCandidatesToClient(jobId, note.trim() || undefined);
      setResult(r);
      if (r.ok) {
        setOpen(false);
        setNote("");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {!open ? (
        <Button
          type="button"
          onClick={() => {
            setResult(null);
            setOpen(true);
          }}
          className="w-fit"
        >
          שליחת המועמדות ללקוח 📧
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-[14px] border border-ink-200 bg-ink-50 p-4">
          <Alert variant="warn">
            שימי לב — המייל יישלח ללקוח {clientName ?? "המקושר למשרה"} ויכלול את פרטי הגישה
            לפורטל.
          </Alert>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="client-personal-note" className="text-xs font-semibold text-ink-700">
              מילים אישיות שישולבו במייל (לא חובה)
            </label>
            <Textarea
              id="client-personal-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="min-h-20 bg-ink-0"
              placeholder="למשל: היה נעים לדבר השבוע — מצורפות המועמדות שסיכמנו עליהן."
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={send} disabled={pending}>
              {pending ? "שולח…" : "שליחה סופית ללקוח 📧"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              ביטול
            </Button>
          </div>
        </div>
      )}
      {result?.ok && <Alert variant="success">המייל נשלח ללקוח ✓</Alert>}
      {result?.error && <Alert variant="danger">{result.error}</Alert>}
    </div>
  );
}
