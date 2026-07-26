"use client";

import { useActionState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Alert, Button, Input } from "@/components/ui";
import {
  addJobQuestion,
  deleteJobQuestion,
  moveJobQuestion,
  type FormState,
} from "@/app/(admin)/admin/actions";

export interface JobQuestionItem {
  id: string;
  question: string;
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
              <span className="flex-1 min-w-0 text-sm text-ink-900">{q.question}</span>
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
        <div className="flex items-center gap-2">
          <Input
            name="question"
            placeholder="למשל: ספרי על פרויקט שבנית בטכנולוגיה של המשרה…"
            required
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={pending} className="shrink-0">
            {pending ? "מוסיפה…" : "הוספת שאלה"}
          </Button>
        </div>
      </form>
    </div>
  );
}
