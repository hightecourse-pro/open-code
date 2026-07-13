"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Upload, FileText, CheckCircle2 } from "lucide-react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { uploadCv, type CvDocState } from "@/app/(app)/cv/actions";

const MAX_BYTES = 10 * 1024 * 1024;

function humanSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function CvUploadForm() {
  const [state, action, pending] = useActionState<CvDocState, FormData>(uploadCv, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [sel, setSel] = useState<{ file: File | null; error: string | null }>({ file: null, error: null });
  const { file, error: sizeError } = sel;

  // Clear the form after a successful upload.
  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset local UI after a completed upload
    setSel({ file: null, error: null });
  }, [state.ok]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > MAX_BYTES) {
      setSel({ file: null, error: `הקובץ גדול מדי (${humanSize(f.size)}). הגודל המרבי הוא 10MB.` });
      e.target.value = "";
      return;
    }
    setSel({ file: f, error: null });
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">הקובץ נשמר ✓</Alert>}
      {sizeError && <Alert variant="danger">{sizeError}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="כותרת" htmlFor="label">
          <Input id="label" name="label" placeholder="למשל: קורות חיים – פרונטאנד" />
        </Field>
        <Field label="סוג" htmlFor="language">
          <Select id="language" name="language" defaultValue="he">
            <option value="he">עברית</option>
            <option value="en">אנגלית</option>
            <option value="job">מותאם למשרה ספציפית</option>
          </Select>
        </Field>
      </div>

      <Field label="קובץ (PDF / DOCX, עד 10MB)" htmlFor="file">
        <label
          htmlFor="file"
          className={
            "flex items-center gap-3 border-2 border-dashed rounded-md px-4 py-4 cursor-pointer transition-colors " +
            (file
              ? "border-[#A7E3C6] bg-tint-mint"
              : "border-ink-300 hover:border-brand-purple")
          }
        >
          {file ? (
            <>
              <CheckCircle2 size={18} className="text-[#1B7A4B] shrink-0" />
              <span className="text-sm text-ink-900 truncate flex items-center gap-1.5">
                <FileText size={15} className="text-ink-500" />
                {file.name} <span className="text-ink-500">· {humanSize(file.size)}</span>
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
          id="file"
          name="file"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf"
          required
          onChange={onFileChange}
          className="sr-only"
        />
      </Field>

      <Button type="submit" disabled={pending || !file} className="w-fit">
        {pending ? "שומר…" : file ? "שמירת הקובץ" : "בחרי קובץ תחילה"}
      </Button>
    </form>
  );
}
