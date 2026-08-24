"use client";

import { useState, useTransition } from "react";
import { MessageSquarePlus, X } from "lucide-react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { createMemberRequest } from "@/app/(app)/requests/actions";

/**
 * The floating "הודעה למערכת" button (PM ask): always in reach, opens a tiny
 * form, and the answer comes back to her in chat — no emails involved.
 */
export function MemberRequestWidget() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="fixed bottom-4 end-4 z-40 flex flex-col items-end gap-2" dir="rtl">
      {open && (
        <div className="w-[320px] max-w-[calc(100vw-2rem)] bg-white border border-ink-200 rounded-[16px] shadow-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-[15px] text-ink-1000">
              הודעה או בקשה לצוות 💜
            </span>
            <button type="button" aria-label="סגירה" onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-900">
              <X size={15} />
            </button>
          </div>

          {sent ? (
            <Alert variant="success">
              קיבלנו! נחזור אלייך כאן בצ&apos;אט ברגע שנטפל 💜
            </Alert>
          ) : (
            <form
              action={(fd) =>
                start(async () => {
                  const res = await createMemberRequest(fd);
                  if (res?.error) setError(res.error);
                  else {
                    setError(null);
                    setSent(true);
                  }
                })
              }
              className="flex flex-col gap-2.5"
            >
              {error && <Alert variant="danger">{error}</Alert>}
              <Field label="נושא" htmlFor="req-subject">
                <Input id="req-subject" name="subject" required maxLength={120} placeholder="על מה מדובר?" />
              </Field>
              <Field label="מה תרצי לספר לנו?" htmlFor="req-body">
                <Textarea id="req-body" name="body" required rows={3} placeholder="בקשה, שאלה, רעיון — הכול מתקבל 💜" />
              </Field>
              <Button type="submit" size="sm" disabled={pending} className="self-start">
                {pending ? "שולחת…" : "שליחה לצוות"}
              </Button>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (sent) setSent(false);
        }}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 font-display font-semibold text-[13px] px-4 py-2.5 rounded-full bg-brand-gradient text-white shadow-glow-pink hover:opacity-95 transition-opacity"
      >
        <MessageSquarePlus size={15} /> יש לך בקשה?
      </button>
    </div>
  );
}
