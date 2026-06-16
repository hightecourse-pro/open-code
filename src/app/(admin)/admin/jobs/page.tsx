import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";
import { AdminCreateJob } from "@/components/patterns/admin-create-job";

export const metadata: Metadata = { title: "ניהול משרות" };

export default async function AdminJobsPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, company, title, source, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;משרות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול משרות</h1>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">הוספת משרה</h3>
        <AdminCreateJob />
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">כל המשרות ({jobs?.length ?? 0})</h3>
        <div className="flex flex-col">
          {(jobs ?? []).map((j) => (
            <div key={j.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
              <Badge variant={j.source === "ours" ? "pink" : "tech"}>
                {j.source === "ours" ? "שלנו" : "פתוחה"}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-900 truncate">{j.title}</div>
                <div className="text-xs text-ink-500">{j.company}</div>
              </div>
              <Badge variant={j.status === "open" ? "mint" : "tech"}>
                {j.status === "open" ? "פתוחה" : "סגורה"}
              </Badge>
            </div>
          ))}
          {(jobs ?? []).length === 0 && <p className="text-ink-500 text-sm py-4">אין משרות עדיין.</p>}
        </div>
      </div>
    </div>
  );
}
