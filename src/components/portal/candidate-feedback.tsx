"use client";

import { useState, useTransition } from "react";
import { CalendarCheck } from "lucide-react";
import { Button, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { saveCandidateFeedback } from "@/app/portal/feedback-actions";

/**
 * The client's feedback controls under a candidate card on a job page: an
 * "invite to interview" toggle and a short note back to the Open Code team.
 * Optimistic toggle; the note saves explicitly and shows its saved state.
 */
export function CandidateFeedback({
  jobId,
  profileId,
  initialMarked,
  initialNote,
}: {
  jobId: string;
  profileId: string;
  initialMarked: boolean;
  initialNote: string | null;
}) {
  const [marked, setMarked] = useState(initialMarked);
  const [note, setNote] = useState(initialNote ?? "");
  const [savedNote, setSavedNote] = useState(initialNote ?? "");
  const [markPending, startMark] = useTransition();
  const [notePending, startNote] = useTransition();
  const [noteError, setNoteError] = useState(false);

  const noteDirty = note.trim() !== savedNote.trim();

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
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-ink-200 bg-white p-3">
      <button
        type="button"
        aria-pressed={marked}
        disabled={markPending}
        onClick={toggleMark}
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-60",
          marked
            ? "border-[#BFE4D1] bg-tint-mint text-[#0F6E4A]"
            : "border-ink-200 bg-ink-0 text-ink-700 hover:border-[#BFE4D1] hover:text-[#0F6E4A]"
        )}
      >
        <CalendarCheck size={14} aria-hidden />
        {marked ? "מסומנת לראיון ✓" : "מזמנים לראיון"}
      </button>

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="min-h-16 text-[13px]"
        placeholder="הערה על המועמדת — נעביר לצוות קוד פתוח"
        aria-label="הערה על המועמדת"
      />
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
