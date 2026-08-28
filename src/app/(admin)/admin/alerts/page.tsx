import type { Metadata } from "next";
import { BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MarkAllReadButton } from "@/components/patterns/alert-row-actions";
import { AlertsList, type AlertItem } from "@/components/patterns/alerts-list";

export const metadata: Metadata = { title: "התראות" };
export const dynamic = "force-dynamic";

export default async function AdminAlertsPage() {
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("admin_alerts")
    .select("id, kind, severity, title, body, count, read_at, last_seen_at, dedupe_key, context")
    .order("last_seen_at", { ascending: false })
    .limit(500);

  const unread = (alerts ?? []).filter((a) => !a.read_at);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <span className="font-mono text-xs text-brand-pink-deep">&lt;alerts/&gt;</span>
          <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">התראות</h1>
          <p className="t-body-sm text-ink-500">
            מה שדורש טיפול מסודר למעלה, עם כפתור שלוקח אותך ישר לשם. ברירת המחדל מציגה רק
            מה שעוד לא נקרא — התראה שסומנה יורדת מהרשימה.
          </p>
        </div>
        {unread.length > 0 && (
          <div className="bg-white border border-ink-200 rounded-md px-3.5 py-2 shadow-sm">
            <MarkAllReadButton />
          </div>
        )}
      </div>

      {(alerts ?? []).length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-[18px] p-10 text-center">
          <BellRing size={28} className="mx-auto text-ink-300 mb-3" />
          <p className="font-display font-bold text-ink-700">שקט טוב 🙂</p>
          <p className="t-body-sm text-ink-500 mt-1">
            אין התראות. כשמשהו ידרוש את תשומת לבך — הוא יופיע כאן, עם ספירה בתפריט.
          </p>
        </div>
      ) : (
        <AlertsList alerts={(alerts ?? []) as AlertItem[]} />
      )}
    </div>
  );
}
