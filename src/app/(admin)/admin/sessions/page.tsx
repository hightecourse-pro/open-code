import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AdminCreateSession } from "@/components/patterns/admin-create-session";
import { AdminSessionsList, type AdminSessionRow } from "./admin-sessions-list";

export const metadata: Metadata = { title: "ניהול סשנים" };

export default async function AdminSessionsPage() {
  const supabase = await createClient();
  const [{ data: sessions }, { data: recordings }] = await Promise.all([
    supabase.from("sessions").select("*").order("scheduled_at", { ascending: false }),
    supabase.from("recordings").select("session_id, video_url"),
  ]);

  // Distinct members who opened each session's content — the "participants"
  // number the PM asked to see on past sessions.
  const ids = (sessions ?? []).map((s) => s.id);
  const viewsBySession = new Map<string, Set<string>>();
  if (ids.length > 0) {
    const { data: views } = await supabase
      .from("content_views")
      .select("owner_id, profile_id")
      .eq("owner_type", "session")
      .in("owner_id", ids);
    for (const v of views ?? []) {
      if (!v.owner_id) continue;
      const set = viewsBySession.get(v.owner_id) ?? new Set<string>();
      set.add(v.profile_id);
      viewsBySession.set(v.owner_id, set);
    }
  }
  const recBySession = new Map(
    (recordings ?? []).filter((r) => r.session_id).map((r) => [r.session_id as string, r.video_url])
  );

  const rows: AdminSessionRow[] = (sessions ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    topic: s.topic,
    scheduled_at: s.scheduled_at,
    status: s.status,
    canceled_at: s.canceled_at,
    zoom_url: s.zoom_url,
    syllabus_url: s.syllabus_url ?? null,
    materials_url: s.materials_url ?? null,
    duration_minutes: s.duration_minutes ?? null,
    views: viewsBySession.get(s.id)?.size ?? 0,
    recordingUrl: recBySession.get(s.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;סשנים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול סשנים</h1>
        <p className="t-body-sm text-ink-700">כל השעות כאן — ובכל מה שהחברות רואות — הן שעון ישראל.</p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
        <h3 className="font-display text-base font-bold mb-3">הוספת סשן</h3>
        <AdminCreateSession />
        <p className="text-[12.5px] text-ink-500 mt-3 bg-ink-50 border border-ink-200 rounded-md px-3 py-2">
          מה קורה אחרי ההוספה? הסשן מופיע מיד במסך האירועים של החברות, והתזכורות נשלחות
          אוטומטית במייל למנויות: בבוקר יום הסשן, חצי שעה לפני, וברגע שהוא מתחיל. מייל הכרזה
          מיידי לא נשלח.
        </p>
      </div>

      <AdminSessionsList sessions={rows} />
    </div>
  );
}
