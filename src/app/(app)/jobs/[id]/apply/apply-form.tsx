"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FileText, Sparkles, Upload } from "lucide-react";
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { QuestionAnswerType } from "@/types/database";
import { submitApplication, type ApplyState } from "./actions";

export interface ApplyQuestion {
  id: string;
  question: string;
  sort_order: number;
  required: boolean;
  answer_type: QuestionAnswerType;
  /** Choice options (select/multiselect) — empty for free-text/number. */
  options: string[];
}

export interface ApplyCvDoc {
  id: string;
  label: string;
  created_at: string;
  /** The CV she marked as default on /cv — false for every doc pre-migration. */
  is_default?: boolean;
}

/**
 * The application wizard form: a friendly profile nudge, the job's questions
 * (required or optional — optional ones are labeled "רשות"), the built-in
 * "fit" question, and the CV choice — the CV she marked as default (or her
 * newest, if she hasn't marked one) or a job-tailored upload.
 */
export function ApplyForm({
  jobId,
  questions,
  cvDocs,
}: {
  jobId: string;
  questions: ApplyQuestion[];
  cvDocs: ApplyCvDoc[];
}) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(
    submitApplication.bind(null, jobId),
    {}
  );
  // Her marked default is the one that gets attached; without one, the newest.
  const defaultCv = cvDocs.find((d) => d.is_default) ?? null;
  const mainCv = defaultCv ?? cvDocs[0] ?? null;
  const [cvMode, setCvMode] = useState<"main" | "upload">(mainCv ? "main" : "upload");

  const radioClass = (active: boolean) =>
    cn(
      "flex items-start gap-3 border rounded-md p-3.5 cursor-pointer transition-colors",
      active ? "border-brand-purple bg-tint-purple" : "border-ink-200 bg-white hover:border-brand-purple"
    );

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Friendly nudge — never blocking */}
      <div className="flex gap-2.5 items-start bg-tint-indigo border border-[#C9D2F0] rounded-md p-3 px-4 text-[13.5px] text-ink-700">
        <Sparkles size={18} className="text-brand-indigo shrink-0 mt-0.5" />
        <span>
          רגע לפני — כדאי לוודא שהפרופיל שלך מעודכן, כי הוא חלק ממה שנציג עלייך.{" "}
          <Link href="/profile" className="text-brand-purple font-semibold">
            לעדכון הפרופיל
          </Link>
        </span>
      </div>

      {/* Per-job questions — rendered by their answer type */}
      {questions.map((q, i) => (
        <Field
          key={q.id}
          label={`${i + 1}. ${q.question}${q.required !== false ? "" : " (רשות)"}`}
          htmlFor={q.answer_type === "multiselect" ? undefined : `q_${q.id}`}
        >
          {q.answer_type === "number" ? (
            <Input
              id={`q_${q.id}`}
              name={`q_${q.id}`}
              type="number"
              inputMode="numeric"
              required={q.required !== false}
              placeholder="התשובה שלך במספר…"
              className="max-w-52"
            />
          ) : q.answer_type === "select" ? (
            q.options.length <= 4 ? (
              // Few options → radio group (one answer), Google-Forms style.
              <div className="flex flex-col gap-2 rounded-sm border border-ink-300 bg-ink-0 px-3.5 py-3">
                {q.options.map((opt) => (
                  <label key={opt} className="inline-flex items-center gap-2.5 cursor-pointer text-sm text-ink-900">
                    <input
                      type="radio"
                      name={`q_${q.id}`}
                      value={opt}
                      required={q.required !== false}
                      className="accent-[#E0418D] w-4 h-4"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <Select
                id={`q_${q.id}`}
                name={`q_${q.id}`}
                required={q.required !== false}
                defaultValue=""
              >
                <option value="" disabled>
                  בחרי…
                </option>
                {q.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            )
          ) : q.answer_type === "multiselect" ? (
            // At-least-one is enforced server-side (only when the question is
            // required) — checkboxes can't carry a group-level required
            // attribute.
            <div className="flex flex-col gap-2 rounded-sm border border-ink-300 bg-ink-0 px-3.5 py-3">
              {q.options.map((opt) => (
                <Checkbox key={opt} name={`q_${q.id}`} value={opt} label={opt} />
              ))}
              <span className="text-xs text-ink-500">אפשר לסמן כמה</span>
            </div>
          ) : (
            <Textarea
              id={`q_${q.id}`}
              name={`q_${q.id}`}
              required={q.required !== false}
              placeholder="התשובה שלך…"
            />
          )}
        </Field>
      ))}

      {/* Always-last built-in question */}
      <Field
        label={`${questions.length + 1}. למה את חושבת שאת מתאימה למשרה?`}
        htmlFor="fit"
      >
        <Textarea
          id="fit"
          name="fit"
          required
          placeholder="ספרי בכמה משפטים למה דווקא את — זו ההזדמנות שלך לבלוט 💜"
        />
      </Field>

      {/* CV choice */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-ink-700">אילו קורות חיים לצרף?</span>
        <p className="text-[12px] text-ink-500 -mt-1">
          רגע לפני ששולחות — רוצה שה-AI יעבור על קורות החיים שלך?{" "}
          <Link href="/ai/cv-checker" className="text-brand-purple font-semibold underline">
            לבדיקה מהירה ←
          </Link>
        </p>

        {mainCv && (
          <label className={radioClass(cvMode === "main")}>
            <input
              type="radio"
              name="cv_mode"
              value="main"
              checked={cvMode === "main"}
              onChange={() => setCvMode("main")}
              className="mt-1 accent-[#E0418D]"
            />
            <span className="flex-1">
              <span className="flex items-center gap-1.5 font-semibold text-sm text-ink-900">
                <FileText size={14} className="text-brand-purple" />
                {defaultCv ? "קורות החיים שסימנת כברירת מחדל" : "קורות החיים האחרונים שהעלית"}
              </span>
              <span className="block text-xs text-ink-500 mt-0.5">
                {mainCv.label}
                {!defaultCv && (
                  <>
                    {" · "}
                    <Link href="/cv" className="text-brand-purple font-semibold">
                      לבחירת ברירת מחדל
                    </Link>
                  </>
                )}
              </span>
            </span>
          </label>
        )}

        <label className={radioClass(cvMode === "upload")}>
          <input
            type="radio"
            name="cv_mode"
            value="upload"
            checked={cvMode === "upload"}
            onChange={() => setCvMode("upload")}
            className="mt-1 accent-[#E0418D]"
          />
          <span className="flex-1">
            <span className="flex items-center gap-1.5 font-semibold text-sm text-ink-900">
              <Upload size={14} className="text-brand-purple" /> העלאת קובץ מותאם למשרה
            </span>
            <span className="block text-xs text-ink-500 mt-0.5">
              PDF או Word (doc/docx), עד 10MB
            </span>
            {cvMode === "upload" && (
              <input
                type="file"
                name="cv_file"
                accept=".pdf,.doc,.docx"
                required
                className="block mt-2.5 text-sm text-ink-700 file:me-3 file:rounded-sm file:border-0 file:bg-brand-gradient file:text-white file:font-semibold file:text-[13px] file:px-3.5 file:py-2 file:cursor-pointer"
              />
            )}
          </span>
        </label>
      </div>

      {state.error && <Alert variant="danger">{state.error}</Alert>}

      <Button type="submit" disabled={pending} bracketed className="self-start">
        {pending ? "שולחת את המועמדות…" : "שליחת המועמדות"}
      </Button>
    </form>
  );
}
