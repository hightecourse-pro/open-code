"use client";

import { useActionState } from "react";
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { saveProfile, type ProfileState } from "@/app/(app)/profile/actions";
import type { ConfigQuestion } from "@/types/database";

type Option = { value: string; label: string };

export interface ProfileFormProps {
  fullName: string;
  questions: ConfigQuestion[];
  answers: Record<string, unknown>; // question_id -> value
}

function options(q: ConfigQuestion): Option[] {
  return Array.isArray(q.options) ? (q.options as unknown as Option[]) : [];
}

export function ProfileForm({ fullName, questions, answers }: ProfileFormProps) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">הפרופיל נשמר ✓</Alert>}

      <Field label="שם מלא" htmlFor="full_name">
        <Input id="full_name" name="full_name" defaultValue={fullName} required />
      </Field>

      {questions.map((q) => {
        const key = `q_${q.id}`;
        const current = answers[q.id];

        if (q.field_type === "select") {
          return (
            <Field key={q.id} label={q.label_he} htmlFor={key}>
              <Select id={key} name={key} defaultValue={typeof current === "string" ? current : ""}>
                <option value="">בחרי…</option>
                {options(q).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          );
        }

        if (q.field_type === "multiselect" || q.field_type === "tags") {
          const arr = Array.isArray(current) ? (current as string[]) : [];
          return (
            <Field key={q.id} label={q.label_he}>
              <div className="flex flex-wrap gap-3 pt-1">
                {options(q).map((o) => (
                  <Checkbox
                    key={o.value}
                    name={key}
                    value={o.value}
                    defaultChecked={arr.includes(o.value)}
                    label={o.label}
                  />
                ))}
              </div>
            </Field>
          );
        }

        if (q.field_type === "bool") {
          return (
            <Field key={q.id} label={q.label_he}>
              <Checkbox name={key} defaultChecked={current === true} label="כן" />
            </Field>
          );
        }

        if (q.field_type === "number") {
          return (
            <Field key={q.id} label={q.label_he} htmlFor={key}>
              <Input
                id={key}
                name={key}
                type="number"
                dir="ltr"
                defaultValue={typeof current === "number" ? current : ""}
              />
            </Field>
          );
        }

        // long text for bio-like keys, otherwise a single line
        const isLong = q.key === "bio";
        return (
          <Field key={q.id} label={q.label_he} htmlFor={key}>
            {isLong ? (
              <Textarea id={key} name={key} defaultValue={typeof current === "string" ? current : ""} />
            ) : (
              <Input id={key} name={key} defaultValue={typeof current === "string" ? current : ""} />
            )}
          </Field>
        );
      })}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "שומר…" : "שמירת הפרופיל"}
      </Button>
    </form>
  );
}
