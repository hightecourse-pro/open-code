"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { addQuestionOption, removeQuestionOption } from "@/app/(admin)/admin/actions";

type Option = { value: string; label: string };

/**
 * Admin editor for a select/multiselect profile question's options
 * (e.g. study places, track specializations, AI tools). Lists maintained as
 * taxonomies (technologies/regions) are edited in the taxonomy section instead.
 */
export function QuestionOptionsEditor({
  questionId,
  options,
}: {
  questionId: string;
  options: Option[];
}) {
  const [list, setList] = useState(options);
  const [val, setVal] = useState("");
  const [, start] = useTransition();

  function add() {
    const v = val.trim();
    if (!v || list.some((o) => o.label === v)) {
      setVal("");
      return;
    }
    setList((l) => [...l, { value: `tmp-${Date.now()}`, label: v }]);
    setVal("");
    start(() => void addQuestionOption(questionId, v));
  }

  function remove(o: Option) {
    setList((l) => l.filter((x) => x.value !== o.value));
    if (!o.value.startsWith("tmp-")) start(() => void removeQuestionOption(questionId, o.value));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {list.map((o) => (
        <span key={o.value} className="inline-flex items-center gap-1">
          <Badge variant="indigo">{o.label}</Badge>
          <button
            type="button"
            onClick={() => remove(o)}
            className="text-ink-400 hover:text-danger -ms-1"
            title="הסרה"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="ערך חדש…"
          className="w-28 text-[12px] border border-ink-300 rounded-md px-2 py-1 outline-none focus:border-brand-purple"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-gradient text-white"
          title="הוספה"
        >
          <Plus size={13} />
        </button>
      </span>
    </div>
  );
}
