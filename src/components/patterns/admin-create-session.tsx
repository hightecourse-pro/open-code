"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { createSession, type FormState } from "@/app/(admin)/admin/actions";
import { fmtIsraelDateTime, israelLocalToIso } from "@/lib/utils";

export function AdminCreateSession() {
  const [state, action, pending] = useActionState<FormState, FormData>(createSession, {});
  // The visible field holds Israel wall-clock text; the hidden one carries the
  // instant. Without this the browser's own zone (or the server's UTC) would
  // decide what "19:00" means.
  const [when, setWhen] = useState("");
  // React clears the uncontrolled fields after a successful action; this one is
  // controlled, so it's cleared here — during render, on the state object the
  // action returned, which is the pattern React recommends over an effect.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) setWhen("");
  }
  const iso = israelLocalToIso(when);

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">הסשן נוסף ✓</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="כותרת" htmlFor="s-title">
          <Input id="s-title" name="title" required />
        </Field>
        <Field label="נושא" htmlFor="s-topic">
          <Input id="s-topic" name="topic" placeholder="AI / DevOps / הכנה לראיונות" />
        </Field>
        <Field label="מועד (שעון ישראל)" htmlFor="s-date">
          <Input
            id="s-date"
            type="datetime-local"
            required
            dir="ltr"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
          <input type="hidden" name="scheduled_at" value={iso} />
          <p className="text-xs text-ink-500">
            {iso ? `יישמר ויוצג לחברות: ${fmtIsraelDateTime(iso)} (שעון ישראל)` : "השעה שתקלידי היא שעון ישראל."}
          </p>
        </Field>
        <Field label="קישור Zoom" htmlFor="s-zoom">
          <Input id="s-zoom" name="zoom_url" dir="ltr" placeholder="https://zoom.us/…" />
        </Field>
        <Field label="משך (דקות)" htmlFor="s-duration">
          <Input id="s-duration" name="duration_minutes" type="number" min={15} step={15} dir="ltr" placeholder="90" />
        </Field>
        <Field label="סילבוס להורדה (רשות)" htmlFor="s-syllabus">
          <Input id="s-syllabus" name="syllabus_url" dir="ltr" placeholder="https://… או /syllabus-2026.pdf" />
        </Field>
        <Field label="חומרים להורדה (רשות, למנויות)" htmlFor="s-materials">
          <Input id="s-materials" name="materials_url" dir="ltr" placeholder="https://drive.google.com/…" />
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "מוסיף…" : "הוספת סשן"}
      </Button>
    </form>
  );
}
