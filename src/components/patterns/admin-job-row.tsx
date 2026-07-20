"use client";

import { useActionState, useState } from "react";
import { Pencil, Lock, Unlock, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { editJob, setJobStatus, deleteJob, type FormState } from "@/app/(admin)/admin/actions";
import type { EmploymentType, JobSource, JobStatus } from "@/types/database";

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
  status: JobStatus;
}

const EMP: Record<EmploymentType, string> = {
  full: "משרה מלאה",
  part: "משרה חלקית",
  student: "משרת סטודנטית",
  freelance: "פרילנס",
};

export function AdminJobRow({ job }: { job: AdminJob }) {
  const [editing, setEditing] = useState(false);
  const [source, setSource] = useState(job.source);
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
    // Re-sync from the row's current data so the "סוג" select never drifts.
    setSource(job.source);
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
          <Field label="סוג">
            <Select name="source" value={source} onChange={(e) => setSource(e.target.value as JobSource)}>
              <option value="ours">משרה שלנו</option>
              <option value="open">משרה מהשוק</option>
            </Select>
          </Field>
          <Field label="היקף">
            <Select name="employment_type" defaultValue={job.employment_type}>
              {Object.entries(EMP).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="מיקום"><Input name="location" defaultValue={job.location ?? ""} /></Field>
          <Field label="טכנולוגיות (מופרדות בפסיק)"><Input name="tech" dir="ltr" defaultValue={job.tech_tags.join(", ")} /></Field>
        </div>
        <Field label={source === "open" ? "קישור להגשה (חובה)" : "קישור להגשה (לא חובה)"}>
          <Input name="external_url" dir="ltr" defaultValue={job.external_url ?? ""} required={source === "open"} />
        </Field>
        <Field label="תיאור"><Textarea name="description" defaultValue={job.description} /></Field>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>{pending ? "שומר…" : "שמירה"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>ביטול</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
      <Badge variant={job.source === "ours" ? "pink" : "tech"}>{job.source === "ours" ? "שלנו" : "שוק"}</Badge>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink-900 truncate">{job.title}</div>
        <div className="text-xs text-ink-500 truncate">
          {job.company} · {EMP[job.employment_type]}
          {job.location ? ` · ${job.location}` : ""}
        </div>
      </div>
      <Badge variant={job.status === "open" ? "mint" : "tech"}>{job.status === "open" ? "פתוחה" : "סגורה"}</Badge>
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
