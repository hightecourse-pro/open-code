"use client";

import { useId, useState, useTransition } from "react";
import { CalendarCheck } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { saveCandidateFeedback } from "@/app/portal/feedback-actions";

/**
 * The client's feedback controls under a candidate card (jobs list and single
 * job page): an "invite to interview" toggle and a short note back to the Open
 * Code team. Optimistic toggle; the note saves explicitly and shows its saved
 * state.
 */
export function CandidateFeedback({
  jobId,
  profileId,
  candidateName,
  initialMarked,
  initialNote,
}: {
  jobId: string;
  profileId: string;
  /** Full display name — the heading invites by first name. */
  candidateName: string;
  initialMarked: boolean;
  initialNote: string | null;
}) {
  const noteId = useId();
  const [marked, setMarked] = useState(initialMarked);
  const [note, setNote] = useState(initialNote ?? "");
  const [savedNote, setSavedNote] = useState(initialNote ?? "");
  const [markPending, startMark] = useTransition();
  const [notePending, startNote] = useTransition();
  const [noteError, setNoteError] = useState(false);

  const noteDirty = note.trim() !== savedNote.trim();
  const firstName = candidateName.trim().split(/\s+/)[0] || candidateName;

  function toggleMark() {
    const next = !marked;
    setMarked(next); // optimistic — revert on failure
    startMark(async () => {
      const res = await saveCandidateFeedback(jobId, profileId, { interviewMarked: next });
      if (!res.ok) setMarked(!next);
    });
  }

  function saveNote() {
    setNoteError(false);
    startNote(async () => {
      const res = await saveCandidateFeedback(jobId, profileId, { clientNote: note });
      if (res.ok) setSavedNote(note);
      else setNoteError(true);
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-2.5 rounded-xl border border-ink-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tint-mint text-[#0F6E4A]">
          <CalendarCheck size={15} aria-hidden />
        </span>
        <p className="font-display text-[14px] font-bold text-ink-1000">
          רוצים לראיין את {firstName}?
        </p>
      </div>

      <button
        type="button"
        aria-pressed={marked}
        disabled={markPending}
        onClick={toggleMark}
        className={cn(
          "inline-flex w-fit items-center rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-60",
          marked
            ? "border-[#BFE4D1] bg-tint-mint text-[#0F6E4A]"
            : "border-ink-200 bg-ink-0 text-ink-700 hover:border-[#BFE4D1] hover:bg-tint-mint/40 hover:text-[#0F6E4A]"
        )}
      >
        {marked ? "מוזמנת לראיון ✓" : "מזמנים לראיון"}
      </button>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={noteId} className="text-xs font-semibold text-ink-700">
          הערה עבורכם ועבורנו (לא חובה)
        </label>
        <Textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="min-h-16 text-[13px]"
          placeholder="מה חשוב לכם שנדע?"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={saveNote}
          disabled={notePending || !noteDirty}
        >
          {notePending ? "שומרים…" : "שמירת הערה"}
        </Button>
        {!noteDirty && savedNote.trim() !== "" && !notePending && (
          <span className="text-xs font-semibold text-success">נשמר ✓</span>
        )}
        {noteError && (
          <span className="text-xs font-semibold text-danger">השמירה נכשלה — נסו שוב</span>
        )}
      </div>
    </div>
  );
}
