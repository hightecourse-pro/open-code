"use client";

import { useActionState, useState } from "react";
import { MailQuestion } from "lucide-react";
import { Alert, Button, Input, Textarea } from "@/components/ui";
import { KIND_ASK, KIND_LABEL, type ReviewRequest } from "@/lib/hackathon-review-shared";
import { respondToReviewRequest, type SubmitState } from "./actions";

const fmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

/**
 * בקשת השלמה (the owner, 24/10): the team asked for something the review
 * could not do without - login details, a working address, a video that
 * opens, a public repo. One card, the fields that were asked for, and it
 * stays editable after she answered. Works even after the submissions closed.
 */
export function ReviewRequestCard({ request }: { request: ReviewRequest }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(respondToReviewRequest, {});
  const kinds = new Set(request.items.map((i) => i.kind));
  const r = request.response ?? {};
  const [now] = useState(() => Date.now()); // read once - the card must not drift while she types
  const overdue = !request.respondedAt && new Date(request.dueAt).getTime() < now;
  return (
    <section id="review-request" className="relative overflow-hidden rounded-[22px] border-2 border-brand-pink bg-tint-pink/30 p-5 md:p-6 shadow-sm scroll-mt-24" data-testid="review-request" data-responded={request.respondedAt ? "1" : "0"}>
      <div className="font-mono text-[12.5px] text-brand-pink-deep">{"// בקשה מצוות ההאקתון"}</div>
      <h2 className="font-display text-[20px] font-black text-ink-1000 flex items-center gap-2">
        <MailQuestion size={20} className="text-brand-pink-deep" /> חסר לנו משהו קטן כדי לבדוק את הפרויקט שלך
      </h2>
      <p className="text-[13.5px] text-ink-700 mt-1">
        הפרויקט שלך כבר אצלנו ואנחנו באמצע הבדיקה. כדי לבדוק אותו כמו שצריך ולנקד אותו הוגן, נשמח שתעדכני כאן עד <b>{fmt.format(new Date(request.dueAt))}</b>
        {overdue && <span className="text-brand-pink-deep font-semibold"> (המועד עבר - עדיין אפשר לעדכן)</span>}.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5 text-[13.5px]">
        {request.items.map((it) => (
          <li key={it.kind} className="flex items-start gap-2">
            <span className="shrink-0 rounded-full bg-white border border-brand-pink/40 px-2.5 py-0.5 text-[12px] font-bold text-brand-pink-deep">{KIND_LABEL[it.kind]}</span>
            <span className="text-ink-800">{it.detail}</span>
          </li>
        ))}
      </ul>

      {request.respondedAt && !state.ok && (
        <Alert variant="success" className="mt-4">
          קיבלנו את העדכון שלך ב-{fmt.format(new Date(request.respondedAt))}. אפשר לעדכן שוב אם משהו השתנה.
        </Alert>
      )}

      <form action={action} className="mt-4 flex flex-col gap-3.5">
        {kinds.has("login") && (
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-ink-800">{KIND_ASK.login}</span>
            <Textarea name="login" rows={3} defaultValue={r.login ?? ""} placeholder={"למשל: עובדת - demo@example.com / Demo2026!\nנציג - rep@example.com / Rep2026!"} dir="auto" />
          </label>
        )}
        {kinds.has("product") && (
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-ink-800">{KIND_ASK.product}</span>
            <Input name="product_url" type="url" dir="ltr" placeholder="https://…" defaultValue={r.product_url ?? ""} />
          </label>
        )}
        {kinds.has("video") && (
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-ink-800">{KIND_ASK.video}</span>
            <Input name="video_url" type="url" dir="ltr" placeholder="https://drive.google.com/file/d/…/view" defaultValue={r.video_url ?? ""} />
          </label>
        )}
        {kinds.has("repo") && (
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-ink-800">{KIND_ASK.repo}</span>
            <Input name="repo_url" type="url" dir="ltr" placeholder="https://github.com/…" defaultValue={r.repo_url ?? ""} />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-800">הערה לצוות (לא חובה)</span>
          <Textarea name="note" rows={2} defaultValue={r.note ?? ""} placeholder="משהו שכדאי שנדע - למשל מתי המערכת תעלה, או איך נכנסים." />
        </label>
        {state.error && <Alert variant="danger">{state.error}</Alert>}
        {state.ok && state.info && <Alert variant="success">{state.info}</Alert>}
        <div>
          <Button type="submit" disabled={pending} data-testid="review-request-submit">
            {pending ? "שומרת…" : request.respondedAt ? "עדכון נוסף" : "שליחת העדכון"}
          </Button>
        </div>
      </form>
    </section>
  );
}
