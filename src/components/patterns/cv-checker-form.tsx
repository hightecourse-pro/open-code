"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Upload } from "lucide-react";
import Link from "next/link";
import { Alert, Button, Field, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { latestCvReviewSince, runCvCheck, type CvState } from "@/app/(app)/ai/cv-checker/actions";
import { CvResultView } from "@/components/patterns/cv-result-view";
import type { CvAnalysis } from "@/lib/ai/cv";

export interface SavedCv {
  id: string;
  label: string;
  isDefault: boolean;
}

const LATEST_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

export function CvCheckerForm({
  savedCvs = [],
  latestReviewAt = null,
  latestReview = null,
}: {
  savedCvs?: SavedCv[];
  /** created_at of the newest review already on screen — the recovery poll's floor. */
  latestReviewAt?: string | null;
  /**
   * Her newest saved review, shown in full right under the form (a member,
   * 18/9: the result "appeared only after a refresh, under previous checks,
   * with no place for the current one"). A fresh run replaces it on screen.
   */
  latestReview?: { createdAt: string; docName: string | null; analysis: CvAnalysis } | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<CvState>({});
  // "background" = the request died mid-flight (filtered networks cut long
  // connections around a minute) but the server keeps working and saves the
  // result — so instead of an error we poll for the saved review (2/9, שפרה
  // למברגר: two "failed" checks, both actually succeeded and persisted).
  const [phase, setPhase] = useState<"idle" | "running" | "background">("idle");
  const pending = phase !== "idle";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    // The newest review already on screen is the recovery floor — a server
    // timestamp, so a skewed client clock can't make the poll miss the result.
    // router.refresh() below keeps it current after each successful run.
    const floor = latestReviewAt;
    setState({});
    setPhase("running");
    try {
      const res = await runCvCheck({}, fd);
      // A filtering proxy can hand back an empty body instead of failing —
      // that is the dropped-connection case too, so recover the same way.
      if (!res || (!res.analysis && !res.error)) throw new Error("empty_result");
      setState(res);
      setPhase("idle");
      if (res.analysis) router.refresh();
    } catch {
      setPhase("background");
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 8000));
        try {
          const found = await latestCvReviewSince(floor);
          if (found?.analysis) {
            setState(found);
            setPhase("idle");
            router.refresh();
            return;
          }
        } catch {
          /* the network is still flaky — keep polling */
        }
      }
      setPhase("idle");
      setState({
        error:
          "החיבור התנתק ולא הצלחנו למשוך את התוצאה. רענני את הדף בעוד כמה דקות — אם הבדיקה הצליחה, היא תופיע בהיסטוריה למטה.",
      });
    }
  }

  const analysis = state.analysis;
  // The result lands below the form — bring it into view so it is never
  // missed on a phone (a member, 18/9).
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (analysis) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [analysis]);
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

      <form onSubmit={onSubmit} className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex flex-col gap-4">
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
          <Link href="/cv" target="_blank" rel="noopener" className="text-brand-purple font-semibold">
            {" "}ניהול קורות החיים
          </Link>
          .
        </p>
        <Field label="תיאור המשרה (אופציונלי — לבדיקת התאמה)" htmlFor="job">
          <Textarea id="job" name="job" rows={4} placeholder="הדביקי תיאור משרה ונבדוק יחד עד כמה את מתאימה…" />
        </Field>
        <Button type="submit" disabled={pending} className="w-fit" bracketed>
          {pending ? "בודק את קורות החיים שלך…" : "בדיקת קורות חיים"}
        </Button>

        {/* The analysis takes real time (10-60s through Google) — a working
            animation says "בעבודה", not a frozen form (the owner, 2026-08-30). */}
        {phase === "background" && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-md border border-[#DDC9EC] bg-tint-purple px-4 py-3"
          >
            <span className="relative flex h-7 w-7 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-purple/25" />
              <span className="relative inline-flex h-7 w-7 animate-spin rounded-full border-[2.5px] border-white border-t-brand-purple" />
            </span>
            <span className="text-[13px] text-ink-700 leading-snug">
              <b className="font-display text-brand-purple">החיבור התנתק — אבל הבדיקה ממשיכה אצלנו ברקע 💜</b>
              <br />
              ברגע שהיא תסתיים, התוצאה תופיע כאן מעצמה. אל תסגרי את הדף.
            </span>
          </div>
        )}
        {phase === "running" && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-md border border-[#DDC9EC] bg-tint-purple px-4 py-3"
          >
            <span className="relative flex h-7 w-7 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-purple/25" />
              <span className="relative inline-flex h-7 w-7 animate-spin rounded-full border-[2.5px] border-white border-t-brand-purple" />
            </span>
            <span className="text-[13px] text-ink-700 leading-snug">
              <b className="font-display text-brand-purple">ה-AI קוראת את קורות החיים שלך ממש עכשיו…</b>
              <br />
              זה יכול לקחת דקה-שתיים — שווה לחכות 💜
            </span>
          </div>
        )}
      </form>

      {analysis ? (
        <div ref={resultRef} className="scroll-mt-4">
          <CvResultView
            analysis={analysis}
            heading={
              <h2 className="font-display text-lg font-bold text-ink-1000">
                התוצאה של הבדיקה הנוכחית 💜
              </h2>
            }
          />
        </div>
      ) : latestReview ? (
        <CvResultView
          analysis={latestReview.analysis}
          heading={
            <div>
              <h2 className="font-display text-lg font-bold text-ink-1000">הבדיקה האחרונה שלך</h2>
              <p className="text-[12.5px] text-ink-500">
                <span suppressHydrationWarning>{LATEST_DATE.format(new Date(latestReview.createdAt))}</span>
                {" · "}
                {latestReview.docName ?? "קובץ שהועלה ישירות"}
              </p>
            </div>
          }
        />
      ) : null}
    </>
  );
}
