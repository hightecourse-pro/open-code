"use client";

import { useActionState, useState } from "react";
import { Check, FileText, Info, Lightbulb, TriangleAlert, X, Upload } from "lucide-react";
import Link from "next/link";
import { Alert, Button, Field, ProgressRing, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { runCvCheck, type CvState } from "@/app/(app)/ai/cv-checker/actions";

export interface SavedCv {
  id: string;
  label: string;
  isDefault: boolean;
}

const INSIGHT_STYLE = {
  good: { icon: Check, cls: "bg-tint-mint text-success", label: "חוזק" },
  warn: { icon: TriangleAlert, cls: "bg-tint-warm text-[#8C5E0E]", label: "לשיפור" },
  bad: { icon: X, cls: "bg-danger-bg text-danger", label: "חשוב" },
  tip: { icon: Lightbulb, cls: "bg-tint-purple text-brand-purple", label: "טיפ" },
} as const;

export function CvCheckerForm({ savedCvs = [] }: { savedCvs?: SavedCv[] }) {
  const [state, action, pending] = useActionState<CvState, FormData>(runCvCheck, {});
  const analysis = state.analysis;
  const hasSaved = savedCvs.length > 0;
  // Her saved CV is the default path — the whole point is not re-uploading a
  // file we already keep for her.
  const [source, setSource] = useState<"saved" | "upload">(hasSaved ? "saved" : "upload");
  const defaultDoc = savedCvs.find((d) => d.isDefault) ?? savedCvs[0];
  const [fileName, setFileName] = useState<string | null>(null);
  // "משהו השתבש" is a passing hiccup, not a key problem — sending her to the
  // keys screen for it taught testers their key was broken when it wasn't.
  const keyIssue = state.reason && state.reason !== "error";

  return (
    <>
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;בודקת קו&quot;ח/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">בודקת קורות חיים</h1>
        <p className="t-body-sm text-ink-700">
          נעבור יחד על קורות החיים שלך — אלה ששמורות אצלנו או קובץ PDF שתעלי. אפשר גם להוסיף תיאור
          משרה לבדיקת התאמה.
        </p>
      </div>

      <form action={action} className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex flex-col gap-4">
        {state.error && (
          <Alert variant={state.reason ? "warn" : "danger"}>
            {state.error}
            {keyIssue && (
              <a href="/ai/keys?next=/ai/cv-checker" className="block mt-1 font-semibold text-brand-purple underline">
                לניהול מפתחות ה-AI ←
              </a>
            )}
          </Alert>
        )}

        {hasSaved && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-ink-700">אילו קורות חיים נבדוק?</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={source === "saved"}
                onClick={() => setSource("saved")}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-full border transition-colors",
                  source === "saved"
                    ? "bg-brand-gradient text-white border-transparent"
                    : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
                )}
              >
                <FileText size={14} /> אלה ששמורות אצלנו
              </button>
              <button
                type="button"
                aria-pressed={source === "upload"}
                onClick={() => setSource("upload")}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[13px] font-semibold px-3.5 py-2 rounded-full border transition-colors",
                  source === "upload"
                    ? "bg-brand-gradient text-white border-transparent"
                    : "bg-white text-ink-700 border-ink-200 hover:border-brand-purple"
                )}
              >
                <Upload size={14} /> קובץ אחר מהמחשב
              </button>
            </div>
          </div>
        )}

        {hasSaved && source === "saved" ? (
          <Field label="קורות החיים מהפרופיל שלך" htmlFor="cv_doc_id">
            <Select id="cv_doc_id" name="cv_doc_id" defaultValue={defaultDoc?.id}>
              {savedCvs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                  {d.isDefault ? " · ברירת המחדל שלך" : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="קובץ קורות החיים (PDF)" htmlFor="cv_file">
            <label
              htmlFor="cv_file"
              className={cn(
                "flex items-center gap-3 border-2 border-dashed rounded-md px-4 py-5 cursor-pointer transition-colors",
                fileName
                  ? "border-success bg-tint-mint/40"
                  : "border-ink-300 hover:border-brand-purple"
              )}
            >
              {fileName ? (
                <>
                  <Check size={20} className="text-success shrink-0" />
                  <span className="text-sm text-ink-900 font-semibold" dir="ltr">
                    {fileName}
                  </span>
                  <span className="text-xs text-ink-500">נבחר ✓ אפשר לבדוק</span>
                </>
              ) : (
                <>
                  <Upload size={20} className="text-brand-purple shrink-0" />
                  <span className="text-sm text-ink-700">בחרי קובץ PDF להעלאה (עד 10MB)</span>
                </>
              )}
            </label>
            <input
              id="cv_file"
              name="cv_file"
              type="file"
              accept="application/pdf"
              required={!(hasSaved && source === "saved")}
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </Field>
        )}
        <p className="text-[12px] text-ink-500 -mt-2">
          רוצה לשמור גרסאות של קורות החיים? נהלי אותן ב
          <Link href="/cv" className="text-brand-purple font-semibold">
            {" "}ניהול קורות החיים
          </Link>
          .
        </p>
        <Field label="תיאור המשרה (אופציונלי — לבדיקת התאמה)" htmlFor="job">
          <Textarea id="job" name="job" rows={4} placeholder="הדביקי תיאור משרה ונבדוק יחד עד כמה את מתאימה…" />
        </Field>
        <Button type="submit" disabled={pending} className="w-fit" bracketed>
          {pending ? "בודקת את קורות החיים שלך…" : "בדיקת קורות חיים"}
        </Button>
      </form>

      {analysis && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex gap-5 items-center">
            <ProgressRing value={analysis.score} size={96} />
            <div>
              <div className="font-display font-bold text-lg text-ink-1000">הציון שלך: {analysis.score}/100</div>
              <p className="t-body-sm text-ink-700 mt-1">{analysis.summary}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {analysis.insights.map((ins, i) => {
              const s = INSIGHT_STYLE[ins.type];
              const Icon = s.icon;
              return (
                <div key={i} className="bg-white border border-ink-200 rounded-md p-4 flex gap-3 items-start">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", s.cls)}>
                    <Icon size={15} />
                  </div>
                  <div>
                    <div className="font-display font-bold text-ink-1000 text-[15px]">{ins.title}</div>
                    <p className="t-body-sm text-ink-700 mt-0.5">{ins.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {analysis.job_fit && (
            <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Info size={18} className="text-brand-purple" />
                <h3 className="font-display font-bold text-ink-1000">התאמה למשרה: {analysis.job_fit.score}/100</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-success mb-1.5">מה שמתאים ✓</div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.job_fit.matched.map((m) => (
                      <span key={m} className="bg-tint-mint text-success text-xs px-2.5 py-1 rounded-full">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-brand-pink-deep mb-1.5">מה שכדאי לחזק</div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.job_fit.missing.map((m) => (
                      <span key={m} className="bg-tint-pink text-brand-pink-deep text-xs px-2.5 py-1 rounded-full">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
