"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { uploadCv, type CvDocState } from "@/app/(app)/cv/actions";

export function CvUploadForm() {
  const [state, action, pending] = useActionState<CvDocState, FormData>(uploadCv, {});

  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      {state.ok && <Alert variant="success">הקובץ נשמר ✓</Alert>}

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
          className="flex items-center gap-3 border-2 border-dashed border-ink-300 rounded-md px-4 py-4 cursor-pointer hover:border-brand-purple transition-colors"
        >
          <Upload size={18} className="text-brand-purple shrink-0" />
          <span className="text-sm text-ink-700">בחרי קובץ להעלאה</span>
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf"
          required
          className="sr-only"
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "מעלה…" : "העלאת קובץ"}
      </Button>
    </form>
  );
}
