"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { grantShareManually, type ShareFormState } from "./actions";

interface Option {
  id: string;
  label: string;
}

/**
 * The grant used to fail in silence — the admin clicked, nothing moved, and
 * she had no way to tell whether it worked. useActionState gives her an answer.
 */
export function ManualShareForm({
  members,
  courses,
  sessions,
}: {
  members: Option[];
  courses: Option[];
  sessions: Option[];
}) {
  const [state, action, pending] = useActionState<ShareFormState, FormData>(grantShareManually, {});

  return (
    <form action={action} className="flex flex-col gap-2">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">{state.ok}</Alert>}
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="profile_id"
          required
          defaultValue=""
          className="text-[13px] border border-ink-300 rounded-md px-2.5 py-2 min-w-[170px]"
        >
          <option value="" disabled>
            בחרי משתתפת…
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          name="content"
          required
          defaultValue=""
          className="text-[13px] border border-ink-300 rounded-md px-2.5 py-2 flex-1 min-w-[200px]"
        >
          <option value="" disabled>
            בחרי תוכן לשיתוף…
          </option>
          <optgroup label="קורסים">
            {courses.map((c) => (
              <option key={c.id} value={`course:${c.id}`}>
                {c.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="סשנים">
            {sessions.map((s) => (
              <option key={s.id} value={`session:${s.id}`}>
                {s.label}
              </option>
            ))}
          </optgroup>
        </select>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "פותחת…" : "שיתוף"}
        </Button>
      </div>
    </form>
  );
}
