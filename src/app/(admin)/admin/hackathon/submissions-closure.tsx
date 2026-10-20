"use client";

import { useState, useTransition } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { setSubmissionsClosed } from "./actions";

const WHEN = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

/**
 * סגירת ההגשות (the owner, 20/10): the teams may edit their submission until
 * the team presses this; from then on every write is refused and the page
 * turns read-only for them. Reopening is one press away.
 */
export function SubmissionsClosure({ closedAt }: { closedAt: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const closed = !!closedAt;
  const toggle = () => {
    const q = closed
      ? "לפתוח את ההגשות מחדש? הצוותים יוכלו שוב לערוך ולהגיש."
      : "לסגור את ההגשות? מרגע זה אף צוות לא יוכל לערוך או להגיש - הן יראו את ההגשה שלהן לקריאה בלבד. אפשר לפתוח מחדש בכל רגע.";
    if (!confirm(q)) return;
    setError(null);
    start(async () => {
      const r = await setSubmissionsClosed(!closed);
      if (r.error) setError(r.error);
    });
  };
  return (
    <div
      className={`flex items-center gap-3 flex-wrap rounded-[14px] border px-4 py-3 ${closed ? "border-ink-400 bg-ink-50" : "border-success/40 bg-success/5"}`}
      data-testid="submissions-closure"
      data-closed={closed ? "1" : "0"}
    >
      {closed ? <Lock size={18} className="text-ink-700" /> : <LockOpen size={18} className="text-success" />}
      <div className="flex-1 min-w-[220px] text-[13.5px]">
        <div className="font-bold text-ink-900">{closed ? `ההגשות סגורות מאז ${WHEN.format(new Date(closedAt as string))}` : "ההגשות פתוחות לעריכה"}</div>
        <div className="text-[12.5px] text-ink-600">
          {closed ? "הצוותים רואים את ההגשה שלהן לקריאה בלבד; כל ניסיון שמירה נדחה." : "כל צוות יכול לערוך ולהגיש מחדש עד שתלחצי ״סגירת ההגשות״."}
        </div>
      </div>
      <Button type="button" size="sm" variant={closed ? "secondary" : "primary"} disabled={pending} onClick={toggle} data-testid="closure-toggle">
        {pending ? "רגע…" : closed ? "פתיחת ההגשות מחדש" : "סגירת ההגשות"}
      </Button>
      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  );
}
