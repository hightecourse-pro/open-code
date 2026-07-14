import type { Metadata } from "next";
import { Calendar, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "אירועים וסשנים" };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export default async function EventsPage() {
  const supabase = await createClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff = now.getTime() - 24 * 3600 * 1000; // canceled sessions hide after 24h

  const [{ data: upcomingRaw }, { data: past }] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("is_published", true)
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("sessions")
      .select("*")
      .eq("is_published", true)
      .lt("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: false })
      .limit(6),
  ]);

  // A canceled session still shows (as "בוטל") for 24h, then disappears.
  const upcoming = (upcomingRaw ?? []).filter(
    (s) => !s.canceled_at || new Date(s.canceled_at).getTime() > cutoff
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;אירועים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">אירועים וסשנים</h1>
        <p className="t-body-sm text-ink-700">סשנים שבועיים, מיטאפים וסדנאות. נשמח לראות אותך 💜</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-ink-1000">הקרובים</h2>
        {upcoming.length > 0 ? (
          upcoming.map((s) => (
            <div
              key={s.id}
              className={
                "bg-white border border-ink-200 rounded-[18px] p-[18px] flex gap-4 items-center shadow-sm" +
                (s.canceled_at ? " opacity-60" : "")
              }
            >
              <div className="w-14 h-14 rounded-md bg-brand-gradient-soft flex flex-col items-center justify-center shrink-0">
                <span className="font-display font-black text-lg text-ink-1000 leading-none">
                  {new Date(s.scheduled_at).getDate()}
                </span>
                <span className="text-[10px] text-ink-500">
                  {new Date(s.scheduled_at).toLocaleDateString("he-IL", { month: "short" })}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                {s.topic && (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-tint-purple text-brand-purple mb-1">
                    {s.topic}
                  </span>
                )}
                <div className="font-display font-bold text-[15px] text-ink-1000 flex items-center gap-2">
                  {s.title}
                  {s.canceled_at && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger-bg text-danger">בוטל</span>
                  )}
                </div>
                <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5">
                  <Calendar size={12} /> {fmtDate(s.scheduled_at)} · {fmtTime(s.scheduled_at)}
                </div>
              </div>
              {s.zoom_url && !s.canceled_at && (
                <a
                  href={s.zoom_url}
                  className="inline-flex items-center gap-1.5 font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-brand-gradient text-white shrink-0"
                >
                  <Video size={14} /> הצטרפות
                </a>
              )}
            </div>
          ))
        ) : (
          <div className="bg-white border border-ink-200 rounded-lg p-6 text-ink-700">
            אין סשנים מתוכננים כרגע — בקרוב נעדכן.
          </div>
        )}
      </section>

      {past && past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-ink-1000">סשנים שעברו</h2>
          <div className="flex flex-col gap-2">
            {past.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0"
              >
                <div className="text-ink-400 text-xs font-mono w-20 shrink-0">{fmtDate(s.scheduled_at)}</div>
                <div className="font-medium text-ink-900 flex-1">{s.title}</div>
                <a href="/recordings" className="text-brand-purple text-sm font-semibold">
                  להקלטה
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
