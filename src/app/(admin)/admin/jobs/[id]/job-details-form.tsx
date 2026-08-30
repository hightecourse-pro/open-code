"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { editJob, type FormState } from "@/app/(admin)/admin/actions";
import { RichTextEditor } from "@/components/patterns/rich-text-editor";
import { JOB_KIND_OPTIONS, type PortalClientOption } from "@/components/patterns/admin-job-row";
import type { EmploymentType, JobKind, JobSource } from "@/types/database";

export interface JobDetailsData {
  id: string;
  company: string;
  title: string;
  source: JobSource;
  employment_type: EmploymentType;
  location: string | null;
  tech_tags: string[];
  external_url: string | null;
  description_html: string | null;
  client_id: string | null;
  job_kind: JobKind;
  practicum_percent: number | null;
  role_category: string | null;
}

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: "full", label: "משרה מלאה" },
  { value: "part", label: "משרה חלקית" },
  { value: "student", label: "משרת סטודנטית" },
  { value: "freelance", label: "פרילנס" },
];

/**
 * The full edit form for an existing job — the same fields as the create form
 * — living on the job page's "פרטי המשרה" tab and submitting editJob.
 */
export function JobDetailsForm({
  job,
  clients,
}: {
  job: JobDetailsData;
  clients: PortalClientOption[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    editJob.bind(null, job.id),
    {}
  );
  const [source, setSource] = useState<JobSource>(job.source);
  const [kind, setKind] = useState<JobKind>(job.job_kind ?? "immediate");
  // Controlled so the hidden company field follows the chosen client (ours).
  const [clientSel, setClientSel] = useState(job.client_id ?? "");
  const companyForClient = clients.find((c) => c.id === clientSel)?.company_name ?? job.company;

  return (
    <form action={action} className="flex flex-col gap-2.5">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">נשמר ✓</Alert>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {source === "ours" ? (
          // The client IS the company — it rides along hidden, no retyping.
          <input type="hidden" name="company" value={companyForClient} />
        ) : (
          <Field label="חברה">
            <Input name="company" defaultValue={job.company} required />
          </Field>
        )}
        <Field label="תפקיד">
          <Input name="title" defaultValue={job.title} required />
        </Field>
        <Field label="מקור">
          <Select
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value as JobSource)}
          >
            <option value="ours">משרה שלנו</option>
            <option value="open">משרה מהשוק</option>
          </Select>
        </Field>
        <Field label="סוג משרה">
          <Select name="job_kind" value={kind} onChange={(e) => setKind(e.target.value as JobKind)}>
            {JOB_KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        {kind === "practicum_percent" && (
          <Field label="אחוז גיוס">
            <Input
              name="practicum_percent"
              type="number"
              min={1}
              max={100}
              defaultValue={job.practicum_percent ?? ""}
              placeholder="למשל 15"
              className="max-w-32"
            />
          </Field>
        )}
        <Field label="תפקיד">
          <Select name="role_category" defaultValue={job.role_category ?? "אחר"}>
            {["פיתוח", "בדיקות", "יישום", "ניתוח מערכות", "דאטה", "ניהול מוצר", "עיצוב", "אחר"].map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="היקף">
          <Select name="employment_type" defaultValue={job.employment_type}>
            {EMPLOYMENT_OPTIONS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="מיקום">
          <Input name="location" defaultValue={job.location ?? ""} />
        </Field>
        <Field label="טכנולוגיות (מופרדות בפסיק)">
          <Input name="tech" dir="ltr" defaultValue={job.tech_tags.join(", ")} />
        </Field>
        <Field label={source === "ours" ? "לקוח (חובה למשרה שלנו)" : "לקוח פורטל (לא חובה)"}>
          <Select
            name="client_id"
            value={clientSel}
            onChange={(e) => setClientSel(e.target.value)}
            required={source === "ours"}
          >
            <option value="" disabled={source === "ours"}>
              {source === "ours" ? "בחרי לקוח…" : "— ללא —"}
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={source === "open" ? "קישור להגשה (חובה)" : "קישור להגשה (לא חובה)"}>
        <Input
          name="external_url"
          dir="ltr"
          defaultValue={job.external_url ?? ""}
          required={source === "open"}
        />
      </Field>
      <Field label="דרישות המשרה (תיאור מעוצב)">
        <RichTextEditor name="description_html" defaultValue={job.description_html} />
      </Field>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "שומר…" : "שמירת פרטי המשרה"}
      </Button>
    </form>
  );
}
