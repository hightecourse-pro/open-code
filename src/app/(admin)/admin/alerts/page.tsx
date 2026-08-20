import type { Metadata } from "next";
import { BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";
import { MarkAllReadButton, MarkReadButton } from "@/components/patterns/alert-row-actions";

export const metadata: Metadata = { title: "התראות" };
export const dynamic = "force-dynamic";

const SEVERITY: Record<string, { label: string; variant: "pink" | "warm" | "tech" }> = {
  critical: { label: "קריטי", variant: "pink" },
  warning: { label: "אזהרה", variant: "warm" },
  info: { label: "מידע", variant: "tech" },
};

const WHEN = new Intl.DateTimeFormat("he-IL", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jerusalem",
});

export default async function AdminAlertsPage() {
  const supabase = await createClient();
  const { data: alerts } = await supabase
    .from("admin_alerts")
    .select("*")
    .order("last_seen_at", { ascending: false })
    .limit(200);

  const unread = (alerts ?? []).filter((a) => !a.read_at);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <span className="font-mono text-xs text-brand-pink-deep">&lt;alerts/&gt;</span>
          <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">התראות</h1>
          <p className="t-body-sm text-ink-500">
            כל מה שהמערכת רוצה שתדעי — תשלומים שנדחו, מנויים שפגו בלי חידוש, שיתופים
            שנכשלו. נשאר כאן גם אחרי שהמייל נעלם בתיבה.
          </p>
        </div>
        {unread.length > 0 && <MarkAllReadButton />}
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
        <div className="flex flex-col gap-2.5">
          {(alerts ?? []).map((a) => {
            const sev = SEVERITY[a.severity] ?? SEVERITY.info;
            return (
              <div
                key={a.id}
                className={
                  "bg-white border rounded-[14px] p-4 flex flex-col gap-1.5 " +
                  (a.read_at
                    ? "border-ink-200 opacity-70"
                    : a.severity === "critical"
                      ? "border-brand-pink-deep border-[1.5px] shadow-sm"
                      : "border-ink-200 shadow-sm")
                }
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={sev.variant}>{sev.label}</Badge>
                  {!a.read_at && (
                    <span className="w-2 h-2 rounded-full bg-brand-pink-deep" aria-label="לא נקראה" />
                  )}
                  <span className="font-display font-bold text-ink-1000 text-[15px]">{a.title}</span>
                  {a.count > 1 && (
                    <span className="text-[11.5px] font-mono text-ink-500 bg-ink-50 border border-ink-200 rounded-full px-2">
                      ×{a.count}
                    </span>
                  )}
                  <span className="ms-auto text-[12px] text-ink-400" dir="ltr">
                    {WHEN.format(new Date(a.last_seen_at))}
                  </span>
                </div>
                {a.body && <p className="t-body-sm text-ink-700">{a.body}</p>}
                {!a.read_at && (
                  <div className="pt-1">
                    <MarkReadButton id={a.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
