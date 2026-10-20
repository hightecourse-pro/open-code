"use client";

import { useActionState } from "react";
import { Alert, Button, Input } from "@/components/ui";
import { RichTextEditor } from "@/components/patterns/rich-text-editor";
import type { Submission } from "@/lib/hackathon-submission";
import { saveSubmission, type SubmitState } from "./actions";

/**
 * The shared part of the submission - either partner saves it, one record per
 * team. The parts and their words are the owner's published text (20/10):
 * the link, the repo, a short architecture description, the original feature.
 * (The video has its own card; the personal questions are per woman.)
 */
export function SubmissionForm({ submission }: { submission: Submission | null }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(saveSubmission, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
        <div>
          <div className="font-mono text-[12.5px] text-brand-pink-deep">{"// המוצר"}</div>
          <h2 className="font-display text-[18px] font-black text-ink-1000">מה מגישות</h2>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-800">1. לינק למערכת בענן</span>
          <span className="text-[12px] text-ink-500">מערכת שכוללת, כמובן, ממשק משתמש נוח שמפעיל את האיג׳נט שבנית - בענן, לא במחשב שלך.</span>
          <Input name="product_url" type="url" dir="ltr" placeholder="https://…" defaultValue={submission?.productUrl ?? ""} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-800">2. לינק לספריית גיט ציבורית</span>
          <span className="text-[12px] text-ink-500">שהעלית אליה את כל הקוד. GitHub / GitLab, ציבורית.</span>
          <Input name="repo_url" type="url" dir="ltr" placeholder="https://github.com/…" defaultValue={submission?.repoUrl ?? ""} />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-800">3. תיאור קצר של הארכיטקטורה שבחרת</span>
          <span className="text-[12px] text-ink-500">לא מסמך ותוכנית, אלא הסבר קצר במילים פשוטות על התהליך והכלים: אילו רכיבים, איפה המודל, באילו כלי AI בנית.</span>
          <RichTextEditor id="architecture" name="architecture" defaultValue={submission?.architecture} placeholder="למשל: Next.js בוורסל, איג׳נט ב-Node עם כלים לשליפת שווי שימוש, Supabase לנתונים, Gemini למודל, נבנה עם Claude Code…" />
        </div>
        <div className="flex flex-col gap-1 rounded-[14px] bg-tint-pink/30 border border-brand-pink/30 p-3.5">
          <span className="text-[13px] font-semibold text-ink-800">5. איזה פיצ׳ר מקורי משלך הוספת למערכת</span>
          <span className="text-[12px] text-ink-600">
            משהו שהארגון לא ביקש, ואם היה רואה, היה כנראה רוצה: מה הוא, למה הוא חשוב לארגון, ואיך מנסים אותו. זה גם קריטריון בשיפוט - ״פיצ׳ר מקורי שלא חשבו עליו״, 15 נקודות.
          </span>
          <RichTextEditor id="original_feature" name="original_feature" defaultValue={submission?.originalFeature} placeholder="למשל: התראה אוטומטית למזכירה כשטופס התחייבות מגיע בלי מספר מרכזי - כדי שלא יחכה שבוע. מנסים: מעלים את הטופס הזה…" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button type="submit" disabled={pending}>
            {pending ? "שומרת…" : "שמירה"}
          </Button>
          {state.error && <Alert variant="danger">{state.error}</Alert>}
          {state.ok && <span className="text-[13px] font-bold text-success">{state.info}</span>}
        </div>
        <p className="text-[12px] text-ink-500">(4. הסרטון - בכרטיס הבא. 6. השאלות על התהליך - בכרטיס אחריו.)</p>
      </section>
    </form>
  );
}
