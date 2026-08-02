"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Alert, Badge, Button, Checkbox, Field, Input, Select } from "@/components/ui";
import { createJob, quickCreateClientForJob, type FormState } from "@/app/(admin)/admin/actions";
import {
  ANSWER_TYPE_BADGE,
  ANSWER_TYPE_LABEL,
  ANSWER_TYPE_OPTIONS,
} from "@/app/(admin)/admin/jobs/[id]/job-questions";
import type { QuestionAnswerType } from "@/types/database";
import { RichTextEditor } from "./rich-text-editor";
import type { PortalClientOption } from "./admin-job-row";
import { JOB_KIND_OPTIONS } from "./admin-job-row";

const EMPLOYMENT: { value: string; label: string }[] = [
  { value: "full", label: "משרה מלאה" },
  { value: "part", label: "משרה חלקית" },
  { value: "student", label: "משרת סטודנטית" },
  { value: "freelance", label: "פרילנס" },
];

export function AdminCreateJob({
  clients,
  initialClientId,
}: {
  clients: PortalClientOption[];
  /** Pre-selected client (arriving from the CRM's "משרה חדשה" button). */
  initialClientId?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(createJob, {});
  const [source, setSource] = useState("ours");
  const [kind, setKind] = useState("immediate");

  // Our jobs start from the client — the pipeline (portal, send-to-client,
  // CRM) hangs off that link. The list is local so an inline quick-create can
  // append + select the new client without a page round-trip.
  const [clientList, setClientList] = useState(clients);
  const [clientId, setClientId] = useState(
    initialClientId && clients.some((c) => c.id === initialClientId) ? initialClientId : ""
  );
  const [company, setCompany] = useState(
    clients.find((c) => c.id === initialClientId)?.company_name ?? ""
  );
  const [showQuick, setShowQuick] = useState(false);
  const [quick, setQuick] = useState({ company: "", contact: "", email: "" });
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickPending, startQuick] = useTransition();

  // Application questions, composed right here during creation — each with a
  // Google-Forms-style answer type (+ options for choice types) and a
  // required/optional flag (required by default).
  const [questions, setQuestions] = useState<
    { question: string; answer_type: QuestionAnswerType; options: string[]; required: boolean }[]
  >([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [newType, setNewType] = useState<QuestionAnswerType>("paragraph");
  const [newRequired, setNewRequired] = useState(true);
  // Choice options are composed one by one, Google-Forms style.
  const [draftOptions, setDraftOptions] = useState<string[]>([]);
  const [optionDraft, setOptionDraft] = useState("");
  const newIsChoice = newType === "select" || newType === "multiselect";
  const canAddQuestion = !!newQuestion.trim() && (!newIsChoice || draftOptions.length >= 2);

  // A question typed but not yet "added" must not be lost on submit — the
  // hidden field carries it too (same shape, same validation server-side).
  const submittedQuestions = canAddQuestion
    ? [
        ...questions,
        {
          question: newQuestion.trim(),
          answer_type: newType,
          options: newIsChoice ? draftOptions : [],
          required: newRequired,
        },
      ]
    : questions;

  function addOption() {
    const o = optionDraft.trim();
    if (!o || draftOptions.includes(o) || draftOptions.length >= 20) return;
    setDraftOptions((prev) => [...prev, o]);
    setOptionDraft("");
  }

  function addQuestion() {
    if (!canAddQuestion) return;
    setQuestions((prev) => [
      ...prev,
      {
        question: newQuestion.trim(),
        answer_type: newType,
        options: newIsChoice ? draftOptions : [],
        required: newRequired,
      },
    ]);
    setNewQuestion("");
    setNewRequired(true);
    setDraftOptions([]);
    setOptionDraft("");
  }

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
        {source === "ours" ? (
          // The client IS the company — no duplicate typing, it rides along
          // hidden. (Members never see it anyway; it's internal + portal-only.)
          <input type="hidden" name="company" value={company} />
        ) : (
          <Field label="חברה" htmlFor="j-company">
            <Input
              id="j-company"
              name="company"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </Field>
        )}
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
      <Field label="דרישות המשרה (תיאור מעוצב)" htmlFor="j-desc-rich">
        <RichTextEditor id="j-desc-rich" name="description_html" />
      </Field>
      <p className="t-caption -mt-1.5">
        גרסת טקסט פשוט (למיילים) נוצרת אוטומטית מהתיאור — עם מעברי השורות, בלי העיצוב.
      </p>

      {source === "ours" && (
        <div className="rounded-md border border-ink-200 bg-ink-50/60 p-3 flex flex-col gap-2">
          <div className="text-sm font-semibold text-ink-900">שאלות למועמדות</div>
          <p className="t-caption -mt-1">
            השאלה &quot;למה את חושבת שאת מתאימה למשרה?&quot; נשאלת תמיד — כאן מוסיפים שאלות לפי
            דרישות המשרה, וכל שאלה אפשר לסמן כחובה או רשות. אפשר לערוך גם אחר כך בדף המשרה.
          </p>
          {questions.map((q, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs text-ink-400 shrink-0 mt-0.5">{i + 1}.</span>
              <span className="flex-1 min-w-0 text-sm text-ink-900">
                {q.question}
                {q.options.length > 0 && (
                  <span className="block text-xs text-ink-500 mt-0.5 truncate">
                    {q.options.join(" · ")}
                  </span>
                )}
              </span>
              {!q.required && (
                <Badge variant="tech" className="shrink-0 px-2 py-0.5 text-[10.5px]">
                  רשות
                </Badge>
              )}
              <Badge
                variant={ANSWER_TYPE_BADGE[q.answer_type]}
                className="shrink-0 px-2 py-0.5 text-[10.5px]"
              >
                {ANSWER_TYPE_LABEL[q.answer_type]}
              </Badge>
              <button
                type="button"
                onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                className="text-ink-400 hover:text-danger text-xs font-semibold shrink-0 mt-0.5"
              >
                הסרה
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="למשל: כמה שנות ניסיון יש לך ב-React?"
              className="flex-1 min-w-52"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addQuestion();
                }
              }}
            />
            <Select
              value={newType}
              onChange={(e) => setNewType(e.target.value as QuestionAnswerType)}
              className="w-auto shrink-0"
              aria-label="סוג התשובה"
            >
              {ANSWER_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Checkbox
              label="שאלת חובה"
              checked={newRequired}
              onChange={(e) => setNewRequired(e.target.checked)}
              className="shrink-0"
            />
            <Button type="button" size="sm" variant="ghost" onClick={addQuestion} disabled={!canAddQuestion}>
              <Plus size={14} /> הוספת השאלה
            </Button>
          </div>
          {newIsChoice && (
            <div className="rounded-sm border border-ink-200 bg-white p-2.5 flex flex-col gap-2">
              {draftOptions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {draftOptions.map((o) => (
                    <span
                      key={o}
                      className="inline-flex items-center gap-1.5 rounded-full bg-tint-purple text-brand-purple text-xs font-semibold px-3 py-1"
                    >
                      {o}
                      <button
                        type="button"
                        onClick={() => setDraftOptions((prev) => prev.filter((x) => x !== o))}
                        aria-label={`הסרת האפשרות ${o}`}
                        className="hover:text-danger cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  value={optionDraft}
                  onChange={(e) => setOptionDraft(e.target.value)}
                  placeholder="הקלידי אפשרות ולחצי Enter…"
                  aria-label="הוספת אפשרות לבחירה"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <Button type="button" size="sm" variant="ghost" onClick={addOption} disabled={!optionDraft.trim()}>
                  <Plus size={13} /> אפשרות
                </Button>
              </div>
              <p className="t-caption -mt-0.5">
                {draftOptions.length < 2
                  ? `עוד ${2 - draftOptions.length} אפשרויות לפחות כדי להוסיף את השאלה`
                  : `${draftOptions.length} אפשרויות`}
              </p>
            </div>
          )}
          <input type="hidden" name="questions" value={JSON.stringify(submittedQuestions)} />
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "מוסיף…" : "הוספת משרה"}
      </Button>
    </form>
  );
}
