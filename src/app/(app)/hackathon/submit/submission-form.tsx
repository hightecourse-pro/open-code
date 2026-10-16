"use client";

import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { RichTextEditor } from "@/components/patterns/rich-text-editor";
import type { Submission } from "@/lib/hackathon-submission";
import { saveSubmission, type SubmitState } from "./actions";

/** The shared part of the submission - either partner saves it, one record per team. */
export function SubmissionForm({ submission }: { submission: Submission | null }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(saveSubmission, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
        <div>
          <div className="font-mono text-[12.5px] text-brand-pink-deep">{"// המוצר"}</div>
          <h2 className="font-display text-[18px] font-black text-ink-1000">מה בניתן</h2>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-800">קישור למוצר עובד</span>
          <span className="text-[12px] text-ink-500">כתובת שבה אפשר לפתוח את המערכת ולנסות אותה - בענן, לא במחשב שלך.</span>
          <Input name="product_url" type="url" dir="ltr" placeholder="https://…" defaultValue={submission?.productUrl ?? ""} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-800">ספריית גיט ציבורית</span>
          <span className="text-[12px] text-ink-500">GitHub / GitLab - ציבורית, כדי שאפשר יהיה לקרוא את הקוד.</span>
          <Input name="repo_url" type="url" dir="ltr" placeholder="https://github.com/…" defaultValue={submission?.repoUrl ?? ""} />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-800">הארכיטקטורה של הפרויקט</span>
          <span className="text-[12px] text-ink-500">אילו רכיבים יש, איך הם מדברים ביניהם, איפה הנתונים, איפה המודל, מה רץ איפה. אפשר כותרות, רשימות וקישורים.</span>
          <RichTextEditor id="architecture" name="architecture" defaultValue={submission?.architecture} placeholder="למשל: Next.js בוורסל, איג׳נט ב-Node עם כלים לשליפת שווי שימוש, Supabase לנתונים, Gemini למודל…" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-800">איזה בעיות משמעותיות נתקלת בהן ואיך פתרת אותן?</span>
          <span className="text-[12px] text-ink-500">הבעיה, מה ניסית, מה עבד בסוף - ומה היית עושה אחרת.</span>
          <RichTextEditor id="challenges_solved" name="challenges_solved" defaultValue={submission?.challengesSolved} placeholder="למשל: המודל ניחש שווי שימוש - פתרנו עם כלי שליפה מהמאגר ופרומפט שאוסר ניחוש…" />
        </div>
      </section>

      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
        <div>
          <div className="font-mono text-[12.5px] text-brand-pink-deep">{"// הכלים"}</div>
          <h2 className="font-display text-[18px] font-black text-ink-1000">איך בניתן</h2>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-800">באיזה כלי AI השתמשת לפיתוח עצמו?</span>
          <span className="text-[12px] text-ink-500">Claude Code, Cursor, Copilot, Lovable, Replit… ואיך בפועל.</span>
          <RichTextEditor id="ai_dev_tools" name="ai_dev_tools" defaultValue={submission?.aiDevTools} compact />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-800">באיזה מודלי AI השתמשת להפעיל את האיג׳נט שלך?</span>
          <span className="text-[12px] text-ink-500">למשל Gemini 2.5 Flash לשיחה, מודל embeddings ל-RAG…</span>
          <RichTextEditor id="ai_models" name="ai_models" defaultValue={submission?.aiModels} compact />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button type="submit" disabled={pending}>
            {pending ? "שומרת…" : "שמירה"}
          </Button>
          {state.error && <Alert variant="danger">{state.error}</Alert>}
          {state.ok && <span className="text-[13px] font-bold text-success">{state.info}</span>}
        </div>
      </section>
    </form>
  );
}
