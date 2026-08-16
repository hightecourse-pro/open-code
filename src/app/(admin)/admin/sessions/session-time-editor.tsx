"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { fmtIsraelDateTime, israelLocalToIso, isoToIsraelInput } from "@/lib/utils";
import { updateSessionSchedule } from "./actions";

/**
 * Shows a session's time in Israel time and lets an admin move it — the field is
 * filled from the very same Israel wall clock that's displayed, so editing round
 * trips instead of drifting by the offset on every save.
 */
export function SessionTimeEditor({ sessionId, scheduledAt }: { sessionId: string; scheduledAt: string }) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState(() => isoToIsraelInput(scheduledAt));
  const iso = israelLocalToIso(when);

  if (!open) {
    return (
      <div className="text-xs text-ink-500 flex items-center gap-1.5" dir="rtl">
        <span dir="ltr">{fmtIsraelDateTime(scheduledAt)}</span>
        <span>שעון ישראל</span>
        <button
          type="button"
          onClick={() => {
            setWhen(isoToIsraelInput(scheduledAt));
            setOpen(true);
          }}
          className="text-brand-purple font-semibold hover:underline"
        >
          שינוי מועד
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updateSessionSchedule(sessionId, formData);
        setOpen(false);
      }}
      className="flex items-center gap-2 flex-wrap mt-1"
    >
      <Clock size={13} className="text-ink-400 shrink-0" />
      <Input
        type="datetime-local"
        dir="ltr"
        required
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        className="w-auto text-xs py-1"
        aria-label="מועד הסשן בשעון ישראל"
      />
      <input type="hidden" name="scheduled_at" value={iso} />
      <span className="text-[11px] text-ink-500">שעון ישראל</span>
      <Button type="submit" size="sm" disabled={!iso}>
        שמירה
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        ביטול
      </Button>
    </form>
  );
}
