import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import { updateReportStatus } from "../actions";

export const metadata: Metadata = { title: "מודרציה" };

const STATUS: Record<string, { label: string; variant: "warm" | "mint" | "tech" }> = {
  open: { label: "פתוח", variant: "warm" },
  reviewed: { label: "טופל", variant: "mint" },
  dismissed: { label: "נדחה", variant: "tech" },
};

export default async function AdminModerationPage() {
  const supabase = await createClient();
  const { data: reports } = await supabase
    .from("reports")
    .select("id, target_type, reason, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;מודרציה/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">מודרציה</h1>
        <p className="t-body-sm text-ink-700">דיווחים על תוכן בקהילה.</p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        {reports && reports.length > 0 ? (
          <div className="flex flex-col">
            {reports.map((r) => {
              const st = STATUS[r.status] ?? STATUS.open;
              return (
                <div key={r.id} className="flex items-center gap-3 py-3 border-b border-ink-100 last:border-b-0">
                  <Badge variant={r.target_type === "post" ? "pink" : "purple"}>
                    {r.target_type === "post" ? "פוסט" : "תגובה"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-ink-900 text-sm truncate">{r.reason || "ללא פירוט"}</div>
                    <div className="text-[11px] text-ink-500">{timeAgo(r.created_at)}</div>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                  {r.status === "open" && (
                    <>
                      <form action={updateReportStatus.bind(null, r.id, "reviewed")}>
                        <Button type="submit" size="sm">טופל</Button>
                      </form>
                      <form action={updateReportStatus.bind(null, r.id, "dismissed")}>
                        <Button type="submit" variant="ghost" size="sm">דחייה</Button>
                      </form>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm py-4">אין דיווחים פתוחים — הקהילה נקייה 💜</p>
        )}
      </div>
    </div>
  );
}
