import type { Metadata } from "next";
import { Calendar, Video, Lock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { UpgradeNote } from "@/components/patterns/upgrade-prompt";

export const metadata: Metadata = { title: "אירועים וסשנים" };

/** The join link only exists on the subscriber read — free rows simply lack it. */
function joinUrl(session: object): string | null {
  return (session as { zoom_url?: string | null }).zoom_url ?? null;
}

// Explicit timezone: Vercel renders in UTC, and a bare toLocale* would show
// members a session time that's off by 2-3 hours.
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
}

export default async function EventsPage() {
  const supabase = await createClient();
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoff = now.getTime() - 24 * 3600 * 1000; // canceled sessions hide after 24h

  // Free members read the sanitized view — it simply has no join link in it,
  // so there's nothing to leak even straight from the API.
  const table = subscriber ? "sessions" : "sessions_public";

  const [{ data: upcomingRaw }, { data: past }] = await Promise.all([
    supabase
      .from(table)
      .select("*")
      .eq("is_published", true)
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from(table)
      .select("*")
      .eq("is_published", true)
      .lt("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: false })
      .limit(6),
  ]);

  // A finished session moves off this screen (it lives in the recordings page);
  // a canceled one still shows (as "בוטל") for 24h, then disappears.
  const upcoming = (upcomingRaw ?? []).filter(
    (s) => s.status !== "done" && (!s.canceled_at || new Date(s.canceled_at).getTime() > cutoff)
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;אירועים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">אירועים וסשנים</h1>
        <p className="t-body-sm text-ink-700">סשנים שבועיים, מיטאפים וסדנאות. נשמח לראות אותך 💜</p>
      </div>

      {!subscriber && (
        <UpgradeNote>
          את רואה מה מתוכנן — קישורי ההצטרפות והתזכורות נפתחים עם מנוי.
        </UpgradeNote>
      )}

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
                  {new Date(s.scheduled_at).toLocaleDateString("he-IL", { day: "numeric", timeZone: "Asia/Jerusalem" })}
                </span>
                <span className="text-[10px] text-ink-500">
                  {new Date(s.scheduled_at).toLocaleDateString("he-IL", { month: "short", timeZone: "Asia/Jerusalem" })}
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
              {!s.canceled_at &&
                (subscriber ? (
                  joinUrl(s) && (
                    <a
                      href={joinUrl(s)!}
                      className="inline-flex items-center gap-1.5 font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-brand-gradient text-white shrink-0"
                    >
                      <Video size={14} /> הצטרפות
                    </a>
                  )
                ) : (
                  <Link
                    href="/join"
                    title="ההצטרפות לסשנים נפתחת עם מנוי"
                    className="inline-flex items-center gap-1.5 font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-white text-brand-purple border-[1.5px] border-brand-purple shrink-0 hover:bg-tint-purple transition-colors"
                  >
                    <Lock size={13} /> נפתח עם מנוי
                  </Link>
                ))}
            </div>
          ))
        ) : (
          <div className="bg-white border border-ink-200 rounded-lg p-6 text-ink-700">
            אין סשנים מתוכננים כרגע — נעדכן אותך ברגע שנקבע משהו חדש.
          </div>
        )}
      </section>

      {(past ?? []).filter((s) => !s.canceled_at).length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-ink-1000">סשנים שעברו</h2>
          <div className="flex flex-col gap-2">
            {(past ?? []).filter((s) => !s.canceled_at).map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0"
              >
                <div className="text-ink-400 text-xs font-mono w-20 shrink-0">{fmtDate(s.scheduled_at)}</div>
                <div className="font-medium text-ink-900 flex-1">{s.title}</div>
                <a href="/recordings" className="text-brand-purple text-sm font-semibold">
                  {subscriber ? "להקלטה" : "להקלטות"}
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
