"use client";

import { useActionState } from "react";
import { CalendarCheck, HandCoins } from "lucide-react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { recordManualPayment, setSubscriptionRenewalDate, type FormState } from "@/app/(admin)/admin/actions";

/**
 * The webhook-failed fallback: a real charge happened at Nedarim but nothing
 * arrived here. Recording it by asmachta goes through the same door the
 * webhook uses, so the member gets a real subscription and a real payment row
 * - not a hand-flipped status that never expires and shows up in no report.
 */
export function ManualPaymentForm({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    recordManualPayment.bind(null, profileId),
    {}
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-[12.5px] text-ink-500">
        חיוב שבוצע בנדרים אבל לא נקלט כאן? רשמי אותו עם מספר האסמכתא - ייווצרו מנוי ותשלום
        אמיתיים, ואם ה־CallBack יגיע אחר כך הוא יזוהה כבר־רשום ולא ייכפל.
      </p>
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="אסמכתא מנדרים" htmlFor="mp-asmachta">
          <Input id="mp-asmachta" name="asmachta" dir="ltr" placeholder="2409609" required />
        </Field>
        <Field label="סכום (₪)" htmlFor="mp-amount">
          <Input id="mp-amount" name="amount" type="number" min={1} step="0.01" dir="ltr" required />
        </Field>
      </div>
      <Button type="submit" size="sm" disabled={pending} className="w-fit">
        <HandCoins size={14} /> {pending ? "רושמת…" : "רישום תשלום והפעלת מנוי"}
      </Button>
    </form>
  );
}

/**
 * תיקון תאריך החידוש (the owner, 4/10): when Nedarim's charge day differs
 * from what the app assumed (טובה זק: charged 14/8, 31/8, next 14/10), set
 * the "paid until" date by hand. Reactivates a paused member; writes no
 * payment row - the next callback carries the real charge.
 */
export function RenewalDateForm({ profileId, currentPeriodEnd }: { profileId: string; currentPeriodEnd: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setSubscriptionRenewalDate.bind(null, profileId), {});
  const current = currentPeriodEnd
    ? new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(currentPeriodEnd))
    : null;
  const defaultValue = currentPeriodEnd ? new Date(currentPeriodEnd).toISOString().slice(0, 10) : "";

  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-[12.5px] text-ink-500">
        הוראת הקבע מחייבת ביום אחר מזה שהמערכת הניחה? קבעי כאן עד מתי המנוי משולם (מועד החיוב הבא בנדרים). חברה
        מושהית חוזרת לפעילה; לא נרשם תשלום - ה־CallBack של החיוב הבא ימשיך מכאן.
        {current && (
          <>
            {" "}
            כרגע: <b dir="ltr">{current}</b>.
          </>
        )}
      </p>
      {state.error && <Alert variant="danger">{state.error}</Alert>}
      <div className="flex items-end gap-3 flex-wrap">
        <Field label="משולם עד (מועד החיוב הבא)" htmlFor="rd-date">
          <Input id="rd-date" name="renewal_date" type="date" dir="ltr" defaultValue={defaultValue} required />
        </Field>
        <Button type="submit" size="sm" disabled={pending} className="w-fit">
          <CalendarCheck size={14} /> {pending ? "מעדכנת…" : "עדכון תאריך החידוש"}
        </Button>
      </div>
    </form>
  );
}
