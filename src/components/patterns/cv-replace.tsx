"use client";

import { useActionState, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { replaceCvFile, type CvDocState } from "@/app/(app)/cv/actions";

/**
 * "החלפת קובץ" on a CV row (the member, 13/10): pick a new PDF/Word and the
 * document keeps its name, language, default flag and every application that
 * already points at it - only the file changes. The picker submits by itself.
 */
export function CvReplaceButton({ id, label }: { id: string; label: string }) {
  const [state, action, pending] = useActionState<CvDocState, FormData>(replaceCvFile.bind(null, id), {});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  return (
    <form ref={formRef} action={action} className="inline-flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        aria-label={`החלפת הקובץ של ${label}`}
        onChange={() => formRef.current?.requestSubmit()}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        title="החלפת הקובץ - השם, השפה וברירת המחדל נשארים"
        className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-purple hover:text-brand-pink-deep whitespace-nowrap cursor-pointer disabled:opacity-60"
      >
        <RefreshCw size={13} className={pending ? "animate-spin" : ""} /> {pending ? "מחליפה…" : "החלפת קובץ"}
      </button>
      {state.error && <span className="text-[11.5px] font-semibold text-[#B42318]">{state.error}</span>}
      {state.ok && <span className="text-[11.5px] font-semibold text-[#1B7A4B]">הוחלף ✓</span>}
    </form>
  );
}
