"use client";

import { useState, useTransition } from "react";
import { DoorOpen } from "lucide-react";
import { Alert } from "@/components/ui";
import { leaveCommunity } from "./actions";

/**
 * "יציאה סופית מהקהילה" (the owner, 18/10): at the foot of the profile, with
 * the consequences spelled out before she confirms, and a reason she writes.
 */
export function LeaveCommunity({ hasSubscription }: { hasSubscription: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="border border-ink-200 bg-white rounded-[16px] p-4">
      {!open ? (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px] text-[13px] text-ink-600">
            <b className="text-ink-800">רוצה לעזוב את הקהילה?</b> נעצוב, אבל זו זכותך. אפשר גם רק להפסיק מיילים - למעלה, בהעדפות המייל.
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="font-display font-semibold text-[13px] px-4 py-2 rounded-md border-[1.5px] border-ink-300 text-ink-600 hover:border-[#B42318] hover:text-[#B42318] transition-colors inline-flex items-center gap-1.5"
          >
            <DoorOpen size={14} /> יציאה סופית מהקהילה
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-leave-dialog>
          <h3 className="font-display text-[16px] font-bold text-ink-1000">לפני שאת יוצאת - מה זה אומר</h3>
          <ul className="text-[13px] text-ink-700 list-disc ps-5 flex flex-col gap-1">
            <li>החשבון שלך נסגר: לא תוכלי להיכנס לקהילה, לפורום, לצ׳אטים, לקורסים ולכלי ה-AI.</li>
            <li>הפרופיל שלך יורד מהמאגר שהמגייסות רואות ולא נשלח יותר מיילים.</li>
            {hasSubscription ? (
              <li>
                <b>יש לך מנוי פעיל.</b> היציאה לא מבטלת אותו אוטומטית - הצוות מטפל בביטול אחרי היציאה, ואין החזר על התקופה שכבר שולמה.
              </li>
            ) : (
              <li>אם יש לך מנוי, הצוות מטפל בביטול שלו אחרי היציאה.</li>
            )}
            <li>מה שכתבת בקהילה נשאר (פוסטים, תשובות). החשבון לא נמחק - אם תרצי לחזור יום אחד, כתבי לנו.</li>
          </ul>
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-ink-700">למה את עוזבת? (חשוב לנו באמת)</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="למשל: מצאתי עבודה, לא הספקתי להיות פעילה, לא מצאתי את מה שחיפשתי…"
              className="w-full rounded-md border border-ink-300 px-3 py-2 text-[14px] focus:outline-none focus:border-brand-purple"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-ink-800">
            <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> הבנתי את ההשלכות ואני רוצה לצאת
          </label>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={!sure || reason.trim().length < 2 || pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  const r = await leaveCommunity(reason.trim());
                  if (r?.error) setError(r.error);
                });
              }}
              className="font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-[#B42318] text-white disabled:opacity-50"
            >
              {pending ? "רגע…" : "כן, לצאת מהקהילה"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="font-display font-semibold text-[13px] px-4 py-2 rounded-md border-[1.5px] border-ink-300 text-ink-700">
              נשארת 💜
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
