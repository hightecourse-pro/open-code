"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { FileText, Sparkles, Upload } from "lucide-react";
import { Alert, Button, Field, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { submitApplication, type ApplyState } from "./actions";

export interface ApplyQuestion {
  id: string;
  question: string;
  sort_order: number;
  required: boolean;
}

export interface ApplyCvDoc {
  id: string;
  label: string;
  created_at: string;
}

/**
 * The application wizard form: a friendly profile nudge, the job's required
 * questions, the built-in "fit" question, and the CV choice — her main
 * (latest) CV or a job-tailored upload.
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
  const mainCv = cvDocs[0] ?? null;
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

      {/* Per-job required questions */}
      {questions.map((q, i) => (
        <Field key={q.id} label={`${i + 1}. ${q.question}`} htmlFor={`q_${q.id}`}>
          <Textarea
            id={`q_${q.id}`}
            name={`q_${q.id}`}
            required={q.required !== false}
            placeholder="התשובה שלך…"
          />
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
                <FileText size={14} className="text-brand-purple" /> קורות החיים הראשיים שלי
              </span>
              <span className="block text-xs text-ink-500 mt-0.5">{mainCv.label}</span>
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
