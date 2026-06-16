import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";
import { AdminCreateSession } from "@/components/patterns/admin-create-session";

export const metadata: Metadata = { title: "ניהול סשנים" };

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminSessionsPage() {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, title, topic, scheduled_at, status")
    .order("scheduled_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;סשנים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול סשנים</h1>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">סשן חדש</h3>
        <AdminCreateSession />
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">כל הסשנים ({sessions?.length ?? 0})</h3>
        <div className="flex flex-col">
          {(sessions ?? []).map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-900 truncate">{s.title}</div>
                <div className="text-xs text-ink-500" dir="ltr">{fmt(s.scheduled_at)}</div>
              </div>
              {s.topic && <Badge variant="purple">{s.topic}</Badge>}
              <Badge variant={s.status === "done" ? "tech" : "mint"}>
                {s.status === "done" ? "הסתיים" : s.status === "live" ? "חי" : "מתוכנן"}
              </Badge>
            </div>
          ))}
          {(sessions ?? []).length === 0 && <p className="text-ink-500 text-sm py-4">אין סשנים עדיין.</p>}
        </div>
      </div>
    </div>
  );
}
