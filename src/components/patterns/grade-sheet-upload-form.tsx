"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Upload, FileText, CheckCircle2 } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { uploadGradeSheet, type GradeSheetState } from "@/app/(app)/cv/grades-actions";

const MAX_BYTES = 10 * 1024 * 1024;

/** The grade-sheet uploader on the CV screen (the owner, 19/9). */
export function GradeSheetUploadForm() {
  const [state, action, pending] = useActionState<GradeSheetState, FormData>(uploadGradeSheet, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sizeError, setSizeError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset local UI after a completed upload
    setFile(null);
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">גליון הציונים נשמר ✓</Alert>}
      {sizeError && <Alert variant="danger">{sizeError}</Alert>}
      <Field label="כותרת (לא חובה)" htmlFor="grades-label">
        <Input id="grades-label" name="label" placeholder="למשל: גליון ציונים סמינר, תשפ״ה" />
      </Field>
      <Field label="קובץ (PDF / Word / תמונה, עד 10MB)" htmlFor="grades-file">
        <label
          htmlFor="grades-file"
          className={
            "flex items-center gap-3 border-2 border-dashed rounded-md px-4 py-4 cursor-pointer transition-colors " +
            (file ? "border-[#A7E3C6] bg-tint-mint" : "border-ink-300 hover:border-brand-purple")
          }
        >
          {file ? (
            <>
              <CheckCircle2 size={18} className="text-[#1B7A4B] shrink-0" />
              <span className="text-sm text-ink-900 truncate flex items-center gap-1.5">
                <FileText size={15} className="text-ink-500" />
                {file.name}
              </span>
              <span className="ms-auto text-[12px] text-brand-purple font-semibold">החלפה</span>
            </>
          ) : (
            <>
              <Upload size={18} className="text-brand-purple shrink-0" />
              <span className="text-sm text-ink-700">בחרי קובץ להעלאה</span>
            </>
          )}
        </label>
        <input
          id="grades-file"
          name="file"
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/*"
          required
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > MAX_BYTES) {
              setSizeError("הקובץ גדול מדי — עד 10MB.");
              setFile(null);
              e.target.value = "";
              return;
            }
            setSizeError(null);
            setFile(f);
          }}
          className="sr-only"
        />
      </Field>
      <Button type="submit" disabled={pending || !file} className="w-fit">
        {pending ? "שומר…" : file ? "שמירת גליון הציונים" : "קודם בחרי קובץ"}
      </Button>
    </form>
  );
}
