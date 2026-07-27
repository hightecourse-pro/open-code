"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Pencil, Lock, Unlock, Trash2, Users } from "lucide-react";
import { Alert, Badge, Button, Field, Input, Select } from "@/components/ui";
import { editJob, setJobStatus, deleteJob, type FormState } from "@/app/(admin)/admin/actions";
import { RichTextEditor } from "./rich-text-editor";
import type {
  EmploymentType,
  JobKind,
  JobPipelineStatus,
  JobSource,
  JobStatus,
} from "@/types/database";

export interface AdminJob {
  id: string;
  company: string;
  title: string;
  source: JobSource;
  employment_type: EmploymentType;
  location: string | null;
  tech_tags: string[];
  external_url: string | null;
  description: string;
  description_html: string | null;
  status: JobStatus;
  client_id: string | null;
  job_kind: JobKind;
  practicum_percent: number | null;
  pipeline_status: JobPipelineStatus;
  created_at?: string;
}

export interface PortalClientOption {
  id: string;
  company_name: string;
}

const EMP: Record<EmploymentType, string> = {
  full: "משרה מלאה",
  part: "משרה חלקית",
  student: "משרת סטודנטית",
  freelance: "פרילנס",
};

/** Shared job-kind labels (create form + edit form + row). */
export const JOB_KIND_OPTIONS: { value: JobKind; label: string }[] = [
  { value: "immediate", label: "גיוס מיידי" },
  { value: "practicum_placement", label: "פרקטיקום 3 חודשים עם השמה בקצה" },
  { value: "practicum_percent", label: "פרקטיקום עם % גיוס" },
  { value: "practicum_free", label: "פרקטיקום ללא התחייבות" },
  { value: "other", label: "אחר" },
];

const KIND_LABEL = Object.fromEntries(JOB_KIND_OPTIONS.map((k) => [k.value, k.label])) as Record<
  JobKind,
  string
>;

// The recruitment-pipeline pill. The status itself is changed from the job's
// detail page — here it is display-only.
const PIPELINE: Record<
  JobPipelineStatus,
  { label: string; variant: "tech" | "mint" | "indigo" | "warm" | "grad" | "pink" }
> = {
  draft: { label: "לא פורסם", variant: "tech" },
  published: { label: "פורסם", variant: "mint" },
  candidates_sent: { label: "נשלחו מועמדות", variant: "indigo" },
  interviews: { label: "ראיונות", variant: "warm" },
  hired: { label: "גויס", variant: "grad" },
  closed_no_hire: { label: "נסגר ללא גיוס", variant: "pink" },
};

export function AdminJobRow({ job, clients }: { job: AdminJob; clients: PortalClientOption[] }) {
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState(job.source);
  const [kind, setKind] = useState<JobKind>(job.job_kind ?? "immediate");
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await editJob(job.id, prev, formData);
      // A successful save closes the edit form (the list refreshes via revalidate).
      if (result.ok) setEditing(false);
      return result;
    },
    {}
  );

  function openEdit() {
    // Re-sync from the row's current data so the selects never drift.
    setSource(job.source);
    setKind(job.job_kind ?? "immediate");
    setEditing(true);
  }

  if (editing) {
    return (
      <form action={action} className="py-3 border-b border-ink-100 flex flex-col gap-2.5">
        {state.error && <Alert variant="danger">{state.error}</Alert>}
        {state.ok && <Alert variant="success">נשמר ✓</Alert>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="חברה"><Input name="company" defaultValue={job.company} required /></Field>
          <Field label="תפקיד"><Input name="title" defaultValue={job.title} required /></Field>
          <Field label="מקור">
            <Select name="source" value={source} onChange={(e) => setSource(e.target.value as JobSource)}>
              <option value="ours">משרה שלנו</option>
              <option value="open">משרה מהשוק</option>
            </Select>
          </Field>
          <Field label="סוג משרה">
            <Select name="job_kind" value={kind} onChange={(e) => setKind(e.target.value as JobKind)}>
              {JOB_KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
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
          <Field label="היקף">
            <Select name="employment_type" defaultValue={job.employment_type}>
              {Object.entries(EMP).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="מיקום"><Input name="location" defaultValue={job.location ?? ""} /></Field>
          <Field label="טכנולוגיות (מופרדות בפסיק)"><Input name="tech" dir="ltr" defaultValue={job.tech_tags.join(", ")} /></Field>
          <Field label={source === "ours" ? "לקוח (חובה למשרה שלנו)" : "לקוח פורטל (לא חובה)"}>
            <Select name="client_id" defaultValue={job.client_id ?? ""} required={source === "ours"}>
              <option value="" disabled={source === "ours"}>
                {source === "ours" ? "בחרי לקוח…" : "— ללא —"}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={source === "open" ? "קישור להגשה (חובה)" : "קישור להגשה (לא חובה)"}>
          <Input name="external_url" dir="ltr" defaultValue={job.external_url ?? ""} required={source === "open"} />
        </Field>
        <Field label="דרישות המשרה (תיאור מעוצב)">
          <RichTextEditor name="description_html" defaultValue={job.description_html} />
        </Field>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>{pending ? "שומר…" : "שמירה"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>ביטול</Button>
        </div>
      </form>
    );
  }

  const pipeline = PIPELINE[job.pipeline_status] ?? PIPELINE.draft;
  const kindLabel = KIND_LABEL[job.job_kind] ?? KIND_LABEL.immediate;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
      <Badge variant={job.source === "ours" ? "pink" : "tech"}>{job.source === "ours" ? "שלנו" : "שוק"}</Badge>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink-900 truncate">{job.title}</div>
        <div className="text-xs text-ink-500 truncate">
          {job.company} · {EMP[job.employment_type]}
          {job.location ? ` · ${job.location}` : ""}
          {` · ${kindLabel}`}
          {job.job_kind === "practicum_percent" && job.practicum_percent != null
            ? ` (${job.practicum_percent}%)`
            : ""}
        </div>
      </div>
      <Badge variant={pipeline.variant}>{pipeline.label}</Badge>
      <Badge variant={job.status === "open" ? "mint" : "tech"}>{job.status === "open" ? "פתוחה" : "סגורה"}</Badge>
      <Link
        href={`/admin/jobs/${job.id}`}
        className="text-ink-400 hover:text-brand-pink-deep p-1.5"
        title="ניהול מועמדות למשרה"
      >
        <Users size={15} />
      </Link>
      <button type="button" onClick={openEdit} className="text-ink-400 hover:text-brand-purple p-1.5" title="עריכה">
        <Pencil size={15} />
      </button>
      <form action={setJobStatus.bind(null, job.id, job.status !== "open")}>
        <button type="submit" className="text-ink-400 hover:text-brand-pink-deep p-1.5" title={job.status === "open" ? "סגירת משרה" : "פתיחה מחדש"}>
          {job.status === "open" ? <Lock size={15} /> : <Unlock size={15} />}
        </button>
      </form>
      <form action={deleteJob.bind(null, job.id)}>
        <button type="submit" className="text-ink-400 hover:text-danger p-1.5" title="מחיקה">
          <Trash2 size={15} />
        </button>
      </form>
    </div>
  );
}
