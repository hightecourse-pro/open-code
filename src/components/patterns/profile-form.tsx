"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { saveProfile, type ProfileState } from "@/app/(app)/profile/actions";
import type { ConfigQuestion, TaxonomyKind } from "@/types/database";

type Option = { value: string; label: string };

export interface ProfileFormProps {
  fullName: string;
  questions: ConfigQuestion[];
  answers: Record<string, unknown>; // question_id -> value
  /** Options for questions whose list is maintained as a taxonomy. */
  taxonomyOptions?: Partial<Record<TaxonomyKind, Option[]>>;
}

const LONG_TEXT = new Set(["bio", "ai_project_links", "notes_for_us", "work_description"]);
const isOtherVal = (v: string) => v === "other";

export function ProfileForm({ fullName, questions, answers, taxonomyOptions = {} }: ProfileFormProps) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});

  function opts(q: ConfigQuestion): Option[] {
    if (q.taxonomy_kind) return taxonomyOptions[q.taxonomy_kind] ?? [];
    return Array.isArray(q.options) ? (q.options as unknown as Option[]) : [];
  }

  // Free-text stored for an "אחר" choice (value isn't in the option list).
  function customText(q: ConfigQuestion): string {
    const vals = opts(q).map((o) => o.value);
    const cur = answers[q.id];
    if (q.field_type === "select" && typeof cur === "string" && cur && !vals.includes(cur)) return cur;
    if ((q.field_type === "multiselect" || q.field_type === "tags") && Array.isArray(cur)) {
      return (cur as string[]).filter((v) => !vals.includes(v) && !isOtherVal(v)).join(", ");
    }
    return "";
  }

  // --- local state: bool answers (drive conditional fields) + open "אחר" inputs ---
  const initBools: Record<string, boolean> = {};
  const initSelOther: Record<string, boolean> = {};
  const initMultiOther: Record<string, boolean> = {};
  for (const q of questions) {
    if (q.field_type === "bool") initBools[q.key] = answers[q.id] === true;
    const vals = opts(q).map((o) => o.value);
    if (q.field_type === "select") {
      const cur = answers[q.id];
      if (typeof cur === "string" && cur && !vals.includes(cur)) initSelOther[q.id] = true;
    } else if (q.field_type === "multiselect" || q.field_type === "tags") {
      const arr = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
      if (arr.some((v) => !vals.includes(v))) initMultiOther[q.id] = true;
    }
  }
  const [bools, setBools] = useState(initBools);
  const [selOther, setSelOther] = useState(initSelOther);
  const [multiOther, setMultiOther] = useState(initMultiOther);

  // Experienced (≥1yr) members answer a different set than juniors. The gate is
  // the bool question keyed "has_experience".
  const hasExperience = bools["has_experience"] ?? false;
  function trackHidden(q: ConfigQuestion): boolean {
    if (q.intake_track === "junior" && hasExperience) return true;
    if (q.intake_track === "experienced" && !hasExperience) return true;
    return false;
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">הפרופיל נשמר ✓</Alert>}

      <Field label="שם מלא" htmlFor="full_name">
        <Input id="full_name" name="full_name" defaultValue={fullName} required />
      </Field>

      {questions.map((q) => {
        // Branch by experience track, then by "אם כן" follow-up dependencies.
        if (trackHidden(q)) return null;
        if (q.depends_on && !bools[q.depends_on]) return null;

        const key = `q_${q.id}`;
        const current = answers[q.id];
        const list = opts(q);

        if (q.field_type === "select") {
          const isOther = selOther[q.id];
          return (
            <Field key={q.id} label={q.label_he} htmlFor={key}>
              <Select
                id={key}
                name={key}
                required={q.required}
                defaultValue={isOther ? "other" : typeof current === "string" ? current : ""}
                onChange={(e) => setSelOther((s) => ({ ...s, [q.id]: e.target.value === "other" }))}
              >
                <option value="">בחרי…</option>
                {list.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {isOther && (
                <Input
                  name={`${key}__other`}
                  placeholder="פירוט…"
                  defaultValue={customText(q)}
                  className="mt-2"
                />
              )}
            </Field>
          );
        }

        if (q.field_type === "multiselect" || q.field_type === "tags") {
          const arr = Array.isArray(current) ? (current as string[]) : [];
          const isOther = multiOther[q.id];
          return (
            <Field key={q.id} label={q.label_he}>
              <div className="flex flex-wrap gap-3 pt-1">
                {list.map((o) => (
                  <Checkbox
                    key={o.value}
                    name={key}
                    value={o.value}
                    defaultChecked={isOtherVal(o.value) ? isOther : arr.includes(o.value)}
                    label={o.label}
                    onChange={
                      isOtherVal(o.value)
                        ? (e) => setMultiOther((s) => ({ ...s, [q.id]: e.target.checked }))
                        : undefined
                    }
                  />
                ))}
              </div>
              {isOther && (
                <Input
                  name={`${key}__other`}
                  placeholder="פירוט…"
                  defaultValue={customText(q)}
                  className="mt-2"
                />
              )}
            </Field>
          );
        }

        if (q.field_type === "bool") {
          return (
            <Field key={q.id} label={q.label_he}>
              <Checkbox
                name={key}
                defaultChecked={bools[q.key]}
                label="כן"
                onChange={(e) => setBools((b) => ({ ...b, [q.key]: e.target.checked }))}
              />
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
                required={q.required}
                defaultValue={typeof current === "number" ? current : ""}
              />
            </Field>
          );
        }

        // text (single line, or long for bio-like keys)
        const isLong = LONG_TEXT.has(q.key);
        return (
          <Field key={q.id} label={q.label_he} htmlFor={key}>
            {isLong ? (
              <Textarea id={key} name={key} defaultValue={typeof current === "string" ? current : ""} />
            ) : (
              <Input
                id={key}
                name={key}
                required={q.required}
                defaultValue={typeof current === "string" ? current : ""}
              />
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
