"use client";

import { useActionState, useState } from "react";
import { DoorOpen, Heart, MailX } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";
import { unsubscribeAction, type UnsubscribeState } from "./actions";

type Choice = "emails" | "leave";

/**
 * The page behind "הסרה" (the owner, 18/10): friendly, two honest options, a
 * reason. `email`/`token` arrive from the mail link; without them she types
 * the address.
 */
export function UnsubscribeForm({ email, token, initialChoice }: { email: string | null; token: string | null; initialChoice: Choice }) {
  const [state, action, pending] = useActionState<UnsubscribeState, FormData>(unsubscribeAction, {});
  const [choice, setChoice] = useState<Choice>(initialChoice);
  const signed = !!email && !!token;

  if (state.ok) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <div className="text-[40px]">{state.done === "left" ? "👋" : state.done === "mail_sent" ? "📬" : "🤍"}</div>
        <h1 className="t-h2">
          {state.done === "left" ? "יצאת מהקהילה" : state.done === "mail_sent" ? "שלחנו לך מייל לאישור" : "הסרנו אותך מרשימת התפוצה"}
        </h1>
        <p className="t-body-sm text-ink-600">
          {state.done === "left"
            ? "תודה שהיית איתנו. אם תרצי לחזור יום אחד - הדלת פתוחה, פשוט כתבי לנו."
            : state.done === "mail_sent"
              ? "כדי לוודא שזו באמת את, שלחנו לכתובת שכתבת מייל עם קישור לאישור היציאה. אם הכתובת לא אצלנו, לא יגיע מייל."
              : "לא נשלח לך יותר מיילים מהקהילה. הכניסה לקהילה והכל שבתוכה נשארים בדיוק כמו שהיו 💜"}
        </p>
        {state.done === "emails" && (
          <p className="text-[12.5px] text-ink-500">מיילים על החשבון שלך (איפוס סיסמה, המנוי) ימשיכו להגיע - הם לא פרסום.</p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <h1 className="t-h2">רגע לפני שאת הולכת 🤍</h1>
        <p className="t-body-sm text-ink-600 mt-1">
          אין לנו עניין להציף אותך. ספרי לנו מה מתאים לך, ונסדר את זה בלחיצה.
        </p>
      </div>

      {signed ? (
        <>
          <input type="hidden" name="email" value={email ?? ""} />
          <input type="hidden" name="token" value={token ?? ""} />
          <p className="text-[13px] text-ink-700 bg-ink-100 rounded-md px-3 py-2">
            הכתובת: <b dir="ltr">{email}</b>
          </p>
        </>
      ) : (
        <Field label="כתובת המייל שאת רוצה להסיר">
          <Input name="email" type="email" required placeholder="name@example.com" dir="ltr" autoComplete="email" />
        </Field>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-[12.5px] font-semibold text-ink-700 mb-1">מה תרצי?</legend>
        <label className={cn("flex items-start gap-3 rounded-[12px] border px-3.5 py-3 cursor-pointer", choice === "emails" ? "border-brand-purple bg-tint-purple/30" : "border-ink-200 bg-white")}>
          <input type="radio" name="choice" value="emails" checked={choice === "emails"} onChange={() => setChoice("emails")} className="mt-1" />
          <MailX size={18} className="text-brand-purple mt-0.5 shrink-0" />
          <span>
            <b className="text-[14px]">רק בלי מיילים - אני נשארת בקהילה</b>
            <span className="block text-[12.5px] text-ink-600">מפסיקות לשלוח לך מיילים. הגישה לקהילה, לפורום, לצ׳אטים ולכל השאר נשארת.</span>
          </span>
        </label>
        <label className={cn("flex items-start gap-3 rounded-[12px] border px-3.5 py-3 cursor-pointer", choice === "leave" ? "border-brand-pink-deep bg-tint-pink/40" : "border-ink-200 bg-white")}>
          <input type="radio" name="choice" value="leave" checked={choice === "leave"} onChange={() => setChoice("leave")} className="mt-1" />
          <DoorOpen size={18} className="text-brand-pink-deep mt-0.5 shrink-0" />
          <span>
            <b className="text-[14px]">אני רוצה לצאת לגמרי מהקהילה</b>
            <span className="block text-[12.5px] text-ink-600">
              החשבון נסגר: בלי כניסה לקהילה, בלי מיילים, והפרופיל יורד מהמאגר שמגייסות רואות. אם יש לך מנוי, הצוות מטפל בביטול שלו. אפשר לחזור יום אחד - בפנייה אלינו.
            </span>
          </span>
        </label>
      </fieldset>

      <Field label={choice === "leave" ? "למה את עוזבת? (חשוב לנו באמת)" : "מה הציף אותך? (לא חובה)"}>
        <textarea
          name="reason"
          rows={3}
          required={choice === "leave"}
          maxLength={1000}
          placeholder={choice === "leave" ? "למשל: מצאתי עבודה, לא הספקתי להיות פעילה, לא מצאתי את מה שחיפשתי…" : "למשל: יותר מדי מיילים, לא רלוונטי לי כרגע…"}
          className="w-full rounded-md border border-ink-300 px-3 py-2 text-[14px] focus:outline-none focus:border-brand-purple"
        />
      </Field>

      {state.error && <Alert variant="danger">{state.error}</Alert>}

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="submit" disabled={pending} style={choice === "leave" ? { background: "#B42318", borderColor: "#B42318", color: "#fff" } : undefined}>
          {pending ? "רגע…" : choice === "leave" ? "לצאת מהקהילה" : "להסיר אותי מהמיילים"}
        </Button>
        <span className="text-[12px] text-ink-500 inline-flex items-center gap-1">
          <Heart size={12} className="text-brand-pink-deep" /> בלי שאלות, בלי להקשות.
        </span>
      </div>
    </form>
  );
}
