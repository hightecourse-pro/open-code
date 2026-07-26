"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { createJob, quickCreateClientForJob, type FormState } from "@/app/(admin)/admin/actions";
import { RichTextEditor } from "./rich-text-editor";
import type { PortalClientOption } from "./admin-job-row";
import { JOB_KIND_OPTIONS } from "./admin-job-row";

const EMPLOYMENT: { value: string; label: string }[] = [
  { value: "full", label: "משרה מלאה" },
  { value: "part", label: "משרה חלקית" },
  { value: "student", label: "משרת סטודנטית" },
  { value: "freelance", label: "פרילנס" },
];

export function AdminCreateJob({ clients }: { clients: PortalClientOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createJob, {});
  const [source, setSource] = useState("ours");
  const [kind, setKind] = useState("immediate");

  // Our jobs start from the client — the pipeline (portal, send-to-client,
  // CRM) hangs off that link. The list is local so an inline quick-create can
  // append + select the new client without a page round-trip.
  const [clientList, setClientList] = useState(clients);
  const [clientId, setClientId] = useState("");
  const [company, setCompany] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const [quick, setQuick] = useState({ company: "", contact: "", email: "" });
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickPending, startQuick] = useTransition();

  function selectClient(id: string) {
    setClientId(id);
    const c = clientList.find((x) => x.id === id);
    // The job's company IS the client — prefill, still editable.
    if (c) setCompany(c.company_name);
  }

  function createQuickClient() {
    setQuickError(null);
    startQuick(async () => {
      const res = await quickCreateClientForJob(quick.company, quick.contact, quick.email);
      if (res.error || !res.id) {
        setQuickError(res.error ?? "משהו השתבש. נסי שוב.");
        return;
      }
      setClientList((prev) => [...prev, { id: res.id!, company_name: res.company_name! }]);
      setClientId(res.id);
      setCompany(res.company_name!);
      setShowQuick(false);
      setQuick({ company: "", contact: "", email: "" });
    });
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">המשרה נוספה ✓</Alert>}

      <Field label="מקור המשרה" htmlFor="j-source">
        <Select id="j-source" name="source" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="ours">משרה שלנו (הגשה פנימית)</option>
          <option value="open">משרה מהשוק (הגשה חיצונית)</option>
        </Select>
      </Field>

      {source === "ours" && (
        <div className="rounded-md border border-brand-purple/30 bg-tint-purple/30 p-3 flex flex-col gap-2.5">
          <Field label="שלב 1 — למי המשרה? בחרי לקוח" htmlFor="j-client">
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                id="j-client"
                name="client_id"
                required
                value={clientId}
                onChange={(e) => selectClient(e.target.value)}
                className="min-w-56 flex-1"
              >
                <option value="" disabled>
                  בחרי לקוח מהפורטל…
                </option>
                {clientList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </Select>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowQuick((v) => !v)}>
                <Plus size={14} /> לקוח חדש
              </Button>
            </div>
          </Field>

          {showQuick && (
            <div className="rounded-sm border border-ink-200 bg-white p-3 flex flex-col gap-2">
              {quickError && <Alert variant="danger">{quickError}</Alert>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder="שם החברה *"
                  value={quick.company}
                  onChange={(e) => setQuick({ ...quick, company: e.target.value })}
                />
                <Input
                  placeholder="איש קשר (לא חובה)"
                  value={quick.contact}
                  onChange={(e) => setQuick({ ...quick, contact: e.target.value })}
                />
                <Input
                  placeholder="מייל (לא חובה)"
                  dir="ltr"
                  value={quick.email}
                  onChange={(e) => setQuick({ ...quick, email: e.target.value })}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={quickPending || !quick.company.trim()}
                onClick={createQuickClient}
                className="w-fit"
              >
                {quickPending ? "יוצרת…" : "יצירת לקוח ובחירה"}
              </Button>
              <p className="t-caption">
                הלקוח ייווצר בסטטוס &quot;משרה בטיפול&quot; — פרטי גישה לפורטל מקצים אחר כך במסך
                לקוחות פורטל.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="חברה" htmlFor="j-company">
          <Input
            id="j-company"
            name="company"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </Field>
        <Field label="תפקיד" htmlFor="j-title">
          <Input id="j-title" name="title" required />
        </Field>
        <Field label="סוג משרה" htmlFor="j-kind">
          <Select id="j-kind" name="job_kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {JOB_KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        {kind === "practicum_percent" && (
          <Field label="אחוז גיוס" htmlFor="j-pct">
            <Input
              id="j-pct"
              name="practicum_percent"
              type="number"
              min={1}
              max={100}
              placeholder="למשל 15"
              className="max-w-32"
            />
          </Field>
        )}
        <Field label="היקף" htmlFor="j-emp">
          <Select id="j-emp" name="employment_type" defaultValue="full">
            {EMPLOYMENT.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="מיקום" htmlFor="j-location">
          <Input id="j-location" name="location" placeholder="תל אביב / מרחוק" />
        </Field>
      </div>
      <Field label="טכנולוגיות (מופרדות בפסיק)" htmlFor="j-tech">
        <Input id="j-tech" name="tech" placeholder="react, nodejs, sql" dir="ltr" />
      </Field>
      <Field
        label={source === "open" ? "קישור להגשה (חובה)" : "קישור להגשה חיצונית (לא חובה)"}
        htmlFor="j-url"
      >
        <Input
          id="j-url"
          name="external_url"
          dir="ltr"
          required={source === "open"}
          placeholder="https://…"
        />
      </Field>
      <Field label="תיאור מעוצב" htmlFor="j-desc-rich">
        <RichTextEditor id="j-desc-rich" name="description_html" />
      </Field>
      <Field label="תיאור (טקסט פשוט, גיבוי)" htmlFor="j-desc">
        <Textarea id="j-desc" name="description" />
      </Field>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "מוסיף…" : "הוספת משרה"}
      </Button>
    </form>
  );
}
