"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Checkbox, Input, Select } from "@/components/ui";
import {
  addJobQuestion,
  deleteJobQuestion,
  moveJobQuestion,
  updateJobQuestion,
  type FormState,
} from "@/app/(admin)/admin/actions";
import type { QuestionAnswerType } from "@/types/database";

// Google-Forms-style answer types — labels and badge colors are shared with
// the create-job builder so the two screens always speak the same language.
export const ANSWER_TYPE_LABEL: Record<QuestionAnswerType, string> = {
  paragraph: "פסקה",
  number: "מספר",
  select: "בחירת תשובה אחת",
  multiselect: "סימון כמה תשובות",
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
  /** Must she answer? Optional questions render with a "רשות" badge. */
  required: boolean;
  sort_order: number;
}

/** The chips editor for choice options — shared by the add and edit forms. */
function OptionsEditor({
  options,
  setOptions,
}: {
  options: string[];
  setOptions: (updater: (prev: string[]) => string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function addOption() {
    const o = draft.trim();
    if (!o || options.includes(o) || options.length >= 20) return;
    setOptions((prev) => [...prev, o]);
    setDraft("");
  }

  return (
    <div className="rounded-sm border border-ink-200 bg-white p-2.5 flex flex-col gap-2">
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <span
              key={o}
              className="inline-flex items-center gap-1.5 rounded-full bg-tint-purple text-brand-purple text-xs font-semibold px-3 py-1"
            >
              {o}
              <button
                type="button"
                onClick={() => setOptions((prev) => prev.filter((x) => x !== o))}
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
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="הקלידי אפשרות ולחצי Enter…"
          aria-label="הוספת אפשרות לבחירה"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
        />
        <Button type="button" size="sm" variant="ghost" onClick={addOption} disabled={!draft.trim()}>
          אפשרות +
        </Button>
      </div>
      <p className="text-[12px] text-ink-500 -mt-0.5">
        {options.length < 2
          ? `עוד ${2 - options.length} אפשרויות לפחות`
          : `${options.length} אפשרויות`}
      </p>
      {/* The server action reads a comma-separated field — the chips feed it. */}
      <input type="hidden" name="options" value={options.join(", ")} />
    </div>
  );
}

/** The inline edit form a question row opens — saves via updateJobQuestion. */
function QuestionEditForm({
  jobId,
  question,
  onClose,
}: {
  jobId: string;
  question: JobQuestionItem;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await updateJobQuestion(question.id, jobId, prev, formData);
      // A successful save closes the editor (the list refreshes via revalidate).
      if (result.ok) onClose();
      return result;
    },
    {}
  );
  const [type, setType] = useState<QuestionAnswerType>(question.answer_type);
  const [options, setOptionsState] = useState<string[]>(question.options);
  const isChoice = type === "select" || type === "multiselect";

  return (
    <form action={action} className="flex-1 flex flex-col gap-2 py-0.5">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          name="question"
          defaultValue={question.question}
          required
          className="flex-1 min-w-52"
          aria-label="נוסח השאלה"
        />
        <Select
          name="answer_type"
          value={type}
          onChange={(e) => setType(e.target.value as QuestionAnswerType)}
          className="w-auto shrink-0"
          aria-label="סוג התשובה"
        >
          {ANSWER_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        {/* Checkbox present in the form data = required; unchecked = רשות. */}
        <Checkbox
          name="required"
          label="שאלת חובה"
          defaultChecked={question.required}
          className="shrink-0"
        />
      </div>
      {isChoice && <OptionsEditor options={options} setOptions={setOptionsState} />}
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending || (isChoice && options.length < 2)}
        >
          {pending ? "שומר…" : "שמירה"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={pending}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

/**
 * Per-job application questions (required or optional): add, edit, delete and
 * reorder. The list itself comes from the server page (ordered by sort_order)
 * — every action revalidates the page, so the server stays the source of
 * truth.
 */
export function JobQuestionsManager({
  jobId,
  questions,
}: {
  jobId: string;
  questions: JobQuestionItem[];
}) {
  // seq remounts the add-form fields after every successful add, so a new
  // question never inherits the previous one's options (the owner, 3/9).
  const [seq, setSeq] = useState(0);
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const r = await addJobQuestion(jobId, prev, formData);
      if (r.ok) setSeq((n) => n + 1);
      return r;
    },
    {}
  );
  const [editingId, setEditingId] = useState<string | null>(null);

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
              {editingId === q.id ? (
                <QuestionEditForm
                  key={q.id}
                  jobId={jobId}
                  question={q}
                  onClose={() => setEditingId(null)}
                />
              ) : (
                <>
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
                    onClick={() => setEditingId(q.id)}
                    className="text-ink-400 hover:text-brand-purple p-1.5 cursor-pointer"
                    title="עריכת השאלה"
                  >
                    <Pencil size={15} />
                  </button>
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
                </>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-ink-500 text-sm py-1">אין שאלות נוספות למשרה הזו עדיין.</p>
      )}

      <form action={action} className="flex flex-col gap-2">
        {state.error && <Alert variant="danger">{state.error}</Alert>}
        <AddQuestionFields key={seq} pending={pending} />
      </form>
    </div>
  );
}

/** The add-form fields — remounted (fresh state) after every successful add. */
function AddQuestionFields({ pending }: { pending: boolean }) {
  const [newType, setNewType] = useState<QuestionAnswerType>("paragraph");
  // Choice options are composed one by one, Google-Forms style.
  const [draftOptions, setDraftOptions] = useState<string[]>([]);
  const isChoice = newType === "select" || newType === "multiselect";
  return (
    <>
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
        {/* Checkbox present in the form data = required; unchecked = רשות. */}
        <Checkbox name="required" label="שאלת חובה" defaultChecked className="shrink-0" />
        <Button type="submit" size="sm" disabled={pending} className="shrink-0">
          {pending ? "מוסיף…" : "הוספת שאלה"}
        </Button>
      </div>
      {isChoice && <OptionsEditor options={draftOptions} setOptions={setDraftOptions} />}
    </>
  );
}
