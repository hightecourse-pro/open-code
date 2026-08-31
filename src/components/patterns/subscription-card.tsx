"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CreditCard, HeartCrack, RotateCcw } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { cancelRenewal, resumeRenewal } from "@/app/(app)/subscription/actions";

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

/** What ending the membership actually closes — the honest goodbye list. */
const LOSSES = [
  "ספריית הקורסים והחומרים שנפתחו לך",
  "הקלטות הסשנים והסשנים החיים",
  "הצ'אט עם חברות הקהילה והמנטוריות",
  "כלי ה-AI — בודקת קורות החיים וסימולטור הראיונות",
  "העדיפות שלך במשרות של הקהילה",
];

export function SubscriptionCard({
  status,
  periodEnd,
  canceledAt,
  priceShekels,
}: {
  status: string;
  periodEnd: string | null;
  canceledAt: string | null;
  priceShekels: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const endDate = periodEnd ? DATE_HE.format(new Date(periodEnd)) : null;
  const active = status === "active";

  function doCancel() {
    start(async () => {
      const res = await cancelRenewal();
      if (res?.error) setError(res.error);
      setConfirming(false);
      // Pull the fresh server state in — the invoked-in-transition action
      // does not repaint the page by itself ("חידוש מנוי בלחיצה לא עובד").
      router.refresh();
    });
  }
  function doResume() {
    start(async () => {
      const res = await resumeRenewal();
      if (res?.error) setError(res.error);
      router.refresh();
    });
  }

  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm flex flex-col gap-3">
      <h2 className="font-display text-lg font-bold text-ink-1000 flex items-center gap-2">
        <CreditCard size={18} className="text-brand-purple" /> המנוי שלי
      </h2>

      {error && <Alert variant="danger">{error}</Alert>}

      {active && !canceledAt && (
        <>
          <p className="text-[14px] text-ink-700 flex items-center gap-2">
            <CalendarClock size={15} className="text-ink-400 shrink-0" />
            <span>
              המנוי פעיל · ₪{priceShekels} לחודש
              {endDate && (
                <>
                  {" · "}מתחדש אוטומטית ב-<b>{endDate}</b>
                </>
              )}
            </span>
          </p>
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-[12.5px] text-ink-500 hover:text-danger underline w-fit"
            >
              ביטול חידוש המנוי
            </button>
          ) : (
            <div className="border border-[#F3C6DD] bg-tint-pink/40 rounded-md p-4 flex flex-col gap-2.5">
              <div className="font-display font-bold text-[14.5px] text-ink-1000 flex items-center gap-1.5">
                <HeartCrack size={16} className="text-brand-pink-deep" /> רגע לפני שנפרדות 💜
              </div>
              <p className="text-[13px] text-ink-700">
                המנוי יישאר פעיל עד <b>{endDate ?? "סוף התקופה ששולמה"}</b>, ואחרי זה ייסגרו:
              </p>
              <ul className="text-[13px] text-ink-700 flex flex-col gap-1 ps-1">
                {LOSSES.map((l) => (
                  <li key={l} className="flex gap-1.5">
                    <span className="text-brand-pink-deep">•</span> {l}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-1">
                <Button type="button" size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                  נשארת 💜
                </Button>
                <button
                  type="button"
                  onClick={doCancel}
                  disabled={pending}
                  className="text-[12.5px] text-ink-500 hover:text-danger underline disabled:opacity-50"
                >
                  {pending ? "מבטלת…" : "כן, לבטל את החידוש"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {active && (
        /* Card replacement rides the request channel (a member, 1/9): the
           standing order lives in Nedarim, so the team coordinates the swap. */
        <button
          type="button"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("oc:open-request", {
                detail: { subject: "החלפת כרטיס אשראי למנוי" },
              })
            )
          }
          className="text-[12.5px] text-ink-500 hover:text-brand-purple underline w-fit"
        >
          החלפת כרטיס אשראי — כתבי לנו ונסדיר את זה יחד
        </button>
      )}

      {active && canceledAt && (
        <>
          <Alert variant="warn">
            ביטלת את חידוש המנוי — הוא יישאר פעיל עד <b>{endDate ?? "סוף התקופה ששולמה"}</b> ואז ייסגר.
          </Alert>
          <button
            type="button"
            onClick={doResume}
            disabled={pending}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-purple hover:underline w-fit disabled:opacity-50"
          >
            <RotateCcw size={14} /> {pending ? "רגע…" : "התחרטתי — להפעיל את החידוש מחדש"}
          </button>
        </>
      )}

      {!active && (
        <>
          <p className="text-[14px] text-ink-700">
            המנוי לא פעיל כרגע{endDate ? ` (הסתיים ב-${endDate})` : ""} — הקהילה מחכה לך חזרה 💜
          </p>
          <Link
            href="/join"
            className="inline-flex w-fit items-center gap-1.5 font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-brand-gradient text-white"
          >
            לחידוש המנוי
          </Link>
        </>
      )}
    </section>
  );
}
