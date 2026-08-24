"use client";

import { useState, useTransition } from "react";
import { Star, X } from "lucide-react";
import { Alert, Button, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { submitSessionFeedback } from "@/app/(app)/session-feedback/actions";

const ASPECTS = [
  { name: "content", label: "התוכן עצמו" },
  { name: "practical", label: "כמה זה מעשי" },
  { name: "clarity", label: "כמה זה היה מובן" },
  { name: "speaker", label: "המרצה" },
] as const;

function StarRow({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="w-32 text-[13px] text-ink-700">{label}</span>
      <span className="flex gap-0.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} מתוך 5`}
            onClick={() => onChange(n)}
            className="p-0.5 cursor-pointer"
          >
            <Star
              size={18}
              className={cn(
                "transition-colors",
                n <= value ? "text-[#E5A93C]" : "text-ink-200"
              )}
              fill={n <= value ? "currentColor" : "none"}
            />
          </button>
        ))}
      </span>
    </div>
  );
}

/**
 * For a week after a session ends: "היית איתנו? דעתך חשובה לנו". A "לא" just
 * closes the ask; a "כן" opens the four ratings the PM specified. Answered
 * once per session — the server keeps it that way.
 */
export function SessionFeedbackBanner({
  sessionId,
  sessionTitle,
}: {
  sessionId: string;
  sessionTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [pending, start] = useTransition();

  if (gone) return null;

  function submit(attended: boolean, fd?: FormData) {
    const data = fd ?? new FormData();
    data.set("attended", attended ? "yes" : "no");
    start(async () => {
      const res = await submitSessionFeedback(sessionId, data);
      if (res?.error) setError(res.error);
      else if (attended) {
        setThanks(true);
        setTimeout(() => setGone(true), 2500);
      } else setGone(true);
    });
  }

  if (thanks) {
    return <Alert variant="success">תודה על המשוב! זה בדיוק מה שעוזר לנו להשתפר 💜</Alert>;
  }

  return (
    <div className="bg-brand-gradient-soft border border-[#DDC9EC] rounded-md p-4 mb-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[14px] text-ink-900 flex-1">
          היית איתנו בסשן <b>&quot;{sessionTitle}&quot;</b>? דעתך חשובה לנו 💜
        </span>
        {!open && (
          <span className="flex gap-2">
            <Button type="button" size="sm" onClick={() => setOpen(true)}>
              כן, הייתי!
            </Button>
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={pending}
              className="text-[13px] text-ink-500 hover:text-ink-900 underline disabled:opacity-50"
            >
              לא הפעם
            </button>
          </span>
        )}
        {open && (
          <button
            type="button"
            aria-label="סגירה"
            onClick={() => setOpen(false)}
            className="text-ink-400 hover:text-ink-900"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && (
        <form
          action={(fd) => {
            for (const a of ASPECTS) fd.set(a.name, String(ratings[a.name] ?? ""));
            submit(true, fd);
          }}
          className="flex flex-col gap-2"
        >
          {error && <Alert variant="danger">{error}</Alert>}
          {ASPECTS.map((a) => (
            <StarRow
              key={a.name}
              label={a.label}
              value={ratings[a.name] ?? 0}
              onChange={(v) => setRatings((r) => ({ ...r, [a.name]: v }))}
            />
          ))}
          <Textarea name="comment" rows={2} placeholder="משהו נוסף שתרצי שנדע? (רשות)" />
          <Button type="submit" size="sm" disabled={pending} className="self-start">
            {pending ? "שולחת…" : "שליחת המשוב 💜"}
          </Button>
        </form>
      )}
    </div>
  );
}
