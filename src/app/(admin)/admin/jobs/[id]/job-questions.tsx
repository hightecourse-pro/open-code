"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Input, Select } from "@/components/ui";
import {
  addJobQuestion,
  deleteJobQuestion,
  moveJobQuestion,
  type FormState,
} from "@/app/(admin)/admin/actions";
import type { QuestionAnswerType } from "@/types/database";

// Google-Forms-style answer types — labels and badge colors are shared with
// the create-job builder so the two screens always speak the same language.
export const ANSWER_TYPE_LABEL: Record<QuestionAnswerType, string> = {
  paragraph: "פסקה",
  number: "מספר",
  select: "בחירה מרשימה",
  multiselect: "בחירה מרובה",
};

export const ANSWER_TYPE_BADGE: Record<
  QuestionAnswerType,
  "tech" | "indigo" | "purple" | "pink"
> = {
  paragraph: "tech",
  number: "indigo",
  select: "purple",
  multiselect: "pink",
};

export const ANSWER_TYPE_OPTIONS = (
  Object.keys(ANSWER_TYPE_LABEL) as QuestionAnswerType[]
).map((value) => ({ value, label: ANSWER_TYPE_LABEL[value] }));

export interface JobQuestionItem {
  id: string;
  question: string;
  answer_type: QuestionAnswerType;
  /** Choice options (select/multiselect) — empty for free-text/number. */
  options: string[];
  sort_order: number;
}

/**
 * Per-job required application questions: add, delete and reorder. The list
 * itself comes from the server page (ordered by sort_order) — every action
 * revalidates the page, so the server stays the source of truth.
 */
export function JobQuestionsManager({
  jobId,
  questions,
}: {
  jobId: string;
  questions: JobQuestionItem[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addJobQuestion.bind(null, jobId),
    {}
  );
  const [newType, setNewType] = useState<QuestionAnswerType>("paragraph");
  const isChoice = newType === "select" || newType === "multiselect";

  return (
    <div className="flex flex-col gap-3">
      {questions.length > 0 ? (
        <ol className="flex flex-col">
          {questions.map((q, i) => (
            <li
              key={q.id}
              className="flex items-center gap-2 py-2.5 border-b border-ink-100 last:border-b-0"
            >
              <span className="font-mono text-xs text-ink-400 w-5 text-center shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 min-w-0 text-sm text-ink-900">
                {q.question}
                {q.options.length > 0 && (
                  <span className="block text-xs text-ink-500 mt-0.5 truncate">
                    {q.options.join(" · ")}
                  </span>
                )}
              </span>
              <Badge
                variant={ANSWER_TYPE_BADGE[q.answer_type]}
                className="shrink-0 px-2 py-0.5 text-[10.5px]"
              >
                {ANSWER_TYPE_LABEL[q.answer_type]}
              </Badge>
              <form action={moveJobQuestion.bind(null, q.id, jobId, "up")}>
                <button
                  type="submit"
                  disabled={i === 0}
                  className="text-ink-400 hover:text-brand-purple disabled:opacity-30 disabled:hover:text-ink-400 p-1.5 cursor-pointer disabled:cursor-not-allowed"
                  title="העברה למעלה"
                >
                  <ChevronUp size={15} />
                </button>
              </form>
              <form action={moveJobQuestion.bind(null, q.id, jobId, "down")}>
                <button
                  type="submit"
                  disabled={i === questions.length - 1}
                  className="text-ink-400 hover:text-brand-purple disabled:opacity-30 disabled:hover:text-ink-400 p-1.5 cursor-pointer disabled:cursor-not-allowed"
                  title="העברה למטה"
                >
                  <ChevronDown size={15} />
                </button>
              </form>
              <form action={deleteJobQuestion.bind(null, q.id, jobId)}>
                <button
                  type="submit"
                  className="text-ink-400 hover:text-danger p-1.5 cursor-pointer"
                  title="מחיקת השאלה"
                >
                  <Trash2 size={15} />
                </button>
              </form>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-ink-500 text-sm py-1">אין שאלות נוספות למשרה הזו עדיין.</p>
      )}

      <form action={action} className="flex flex-col gap-2">
        {state.error && <Alert variant="danger">{state.error}</Alert>}
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            name="question"
            placeholder="למשל: ספרי על פרויקט שבנית בטכנולוגיה של המשרה…"
            required
            className="flex-1 min-w-52"
          />
          <Select
            name="answer_type"
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
          <Button type="submit" size="sm" disabled={pending} className="shrink-0">
            {pending ? "מוסיפה…" : "הוספת שאלה"}
          </Button>
        </div>
        {isChoice && (
          <>
            <Input
              name="options"
              placeholder="אפשרות 1, אפשרות 2, …"
              aria-label="אפשרויות לבחירה (מופרדות בפסיק)"
            />
            <p className="text-[12px] text-ink-500 -mt-1">
              לפחות שתי אפשרויות, מופרדות בפסיק.
            </p>
          </>
        )}
      </form>
    </div>
  );
}
