"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { setFeedbackPublished } from "./actions";

const WHEN = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });

/**
 * פתיחת המשוב לצוותים (the owner, 5/11): until she presses this, no team sees
 * its feedback; from then on every team with a report sees its card on the
 * submission page. Closing hides it again, one press away.
 */
export function FeedbackPublication({ publishedAt, teams }: { publishedAt: string | null; teams: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const on = !!publishedAt;
  const toggle = () => {
    const q = on ? "לסגור את המשוב? הצוותים יפסיקו לראות את המשוב בדף ההגשה." : `לפתוח את המשוב ל-${teams} הצוותים? כל צוות יראה את המשוב על הפרויקט שלו בדף הגשת התוצרים - בלי ציונים.`;
    if (!confirm(q)) return;
    setError(null);
    start(async () => {
      const r = await setFeedbackPublished(!on);
      if (r.error) setError(r.error);
    });
  };
  return (
    <div
      className={`flex items-center gap-3 flex-wrap rounded-[14px] border px-4 py-3 ${on ? "border-success/40 bg-success/5" : "border-ink-300 bg-ink-50"}`}
      data-testid="feedback-publication"
      data-on={on ? "1" : "0"}
    >
      {on ? <Eye size={18} className="text-success" /> : <EyeOff size={18} className="text-ink-600" />}
      <div className="flex-1 min-w-[220px] text-[13.5px]">
        <div className="font-bold text-ink-900">{on ? `המשוב פתוח לצוותים מאז ${WHEN.format(new Date(publishedAt as string))}` : "המשוב סגור - הצוותים עוד לא רואים אותו"}</div>
        <div className="text-[12.5px] text-ink-600">
          {on ? "כל צוות רואה את המשוב על הפרויקט שלו בדף הגשת התוצרים, לפי הקריטריונים ובלי ציונים." : "לפני שפותחים: התצוגה המקדימה של כל צוות היא בדיוק מה שהצוות יראה."}
        </div>
      </div>
      <Button type="button" size="sm" variant={on ? "secondary" : "primary"} disabled={pending} onClick={toggle} data-testid="feedback-toggle">
        {pending ? "רגע…" : on ? "סגירת המשוב" : "פתיחת המשוב לצוותים"}
      </Button>
      {error && <Alert variant="danger">{error}</Alert>}
    </div>
  );
}
