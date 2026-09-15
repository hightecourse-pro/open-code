"use client";

import { startTransition, useActionState, useState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { saveCoordinatorReview, type ReviewState } from "../../../actions";
import type { CoordinatorReview } from "@/lib/coordinator-data";

const SCALE = [
  { value: "", label: "— לא דירגתי —" },
  { value: "5", label: "5 · מצוינת" },
  { value: "4", label: "4 · טובה מאוד" },
  { value: "3", label: "3 · טובה" },
  { value: "2", label: "2 · בסדר" },
  { value: "1", label: "1 · דורשת חיזוק" },
];

/** The coordinator's private assessment — hers and the team's eyes only. */
export function CoordinatorReviewForm({
  profileId,
  existing,
}: {
  profileId: string;
  existing: CoordinatorReview | null;
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(
    saveCoordinatorReview.bind(null, profileId),
    {}
  );
  const [found, setFound] = useState(
    existing?.found_job === true ? "yes" : existing?.found_job === false ? "no" : ""
  );

  return (
    // Submitted through onSubmit (not the form action prop) on purpose: the
    // built-in post-action form reset blanks the <select>s, which reads as
    // "לא נשמר" a second after a successful save.
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      className="flex flex-col gap-3"
    >
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">חוות הדעת נשמרה ✓ תודה!</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="רמת תקשורת" htmlFor="rv-comm">
          <Select id="rv-comm" name="communication" defaultValue={existing?.communication?.toString() ?? ""}>
            {SCALE.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="כישרון ויכולת מקצועית" htmlFor="rv-talent">
          <Select id="rv-talent" name="talent" defaultValue={existing?.talent?.toString() ?? ""}>
            {SCALE.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="האם מצאה עבודה?" htmlFor="rv-found">
          <Select id="rv-found" name="found_job" value={found} onChange={(e) => setFound(e.target.value)}>
            <option value="">— לא ידוע לי —</option>
            <option value="yes">כן, מצאה עבודה 🎉</option>
            <option value="no">עדיין מחפשת</option>
          </Select>
        </Field>
        {found === "yes" && (
          <Field label="איפה? (אם ידוע)" htmlFor="rv-place">
            <Input
              id="rv-place"
              name="found_job_place"
              defaultValue={existing?.found_job_place ?? ""}
              maxLength={200}
              placeholder="שם החברה / המקום"
            />
          </Field>
        )}
      </div>

      <Field label="הערה חופשית" htmlFor="rv-note">
        <Textarea
          id="rv-note"
          name="note"
          rows={4}
          maxLength={4000}
          defaultValue={existing?.note ?? ""}
          placeholder="כל מה שיעזור לנו להכיר אותה טוב יותר — חוזקות, אופי, דברים לשים לב אליהם…"
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "שומרת…" : "שמירת חוות הדעת"}
        </Button>
        <span className="text-[11.5px] text-ink-400">גלוי רק לך ולצוות קוד פתוח.</span>
      </div>
    </form>
  );
}
