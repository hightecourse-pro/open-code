import type { Metadata } from "next";
import { Calendar, Video, Lock, FileDown, FolderDown, Check } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { UpgradeNote } from "@/components/patterns/upgrade-prompt";
// Vercel renders in UTC; these formatters pin every session time to Israel time.
import { fmtIsraelDate, fmtIsraelTime } from "@/lib/utils";

export const metadata: Metadata = { title: "אירועים וסשנים" };
// A session goes live by the clock — the page must notice without a deploy.
export const dynamic = "force-dynamic";

/** The join link only exists on the subscriber read — free rows simply lack it. */
function joinUrl(session: object): string | null {
  return (session as { zoom_url?: string | null }).zoom_url ?? null;
}

/** Materials, like the zoom link, exist only on the subscriber read. */
function materialsUrl(session: object): string | null {
  return (session as { materials_url?: string | null }).materials_url ?? null;
}

/** A session counts as "live" from its start until this many ms later. */
const LIVE_WINDOW_MS = 2 * 3600 * 1000;

function SessionFiles({
  syllabus,
  materials,
  subscriber,
}: {
  syllabus: string | null;
  materials: string | null;
  subscriber: boolean;
}) {
  if (!syllabus && !materials) return null;
  return (
    <span className="flex items-center gap-3 flex-wrap">
      {syllabus && (
        <a
          href={syllabus}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-purple hover:underline"
        >
          <FileDown size={12} /> סילבוס
        </a>
      )}
      {materials && subscriber && (
        <a
          href={materials}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-purple hover:underline"
        >
          <FolderDown size={12} /> חומרים
        </a>
      )}
    </span>
  );
}

export default async function EventsPage() {
  const supabase = await createClient();
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);
  const now = new Date();
  const cutoff = now.getTime() - 24 * 3600 * 1000; // canceled sessions hide after 24h
  // A session that started less than two hours ago is happening NOW — it
  // belongs at the top with a live badge, not in the "עברו" list.
  const liveEdgeIso = new Date(now.getTime() - LIVE_WINDOW_MS).toISOString();

  // Free members read the sanitized view — it simply has no join link in it,
  // so there's nothing to leak even straight from the API.
  const table = subscriber ? "sessions" : "sessions_public";

  const [{ data: upcomingRaw }, { data: past }] = await Promise.all([
    supabase
      .from(table)
      .select("*")
      .eq("is_published", true)
      .gte("scheduled_at", liveEdgeIso)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from(table)
      .select("*")
      .eq("is_published", true)
      .lt("scheduled_at", liveEdgeIso)
      .order("scheduled_at", { ascending: false })
      .limit(6),
  ]);

  // A finished session moves off this screen (it lives in the recordings page);
  // a canceled one still shows (as "בוטל") for 24h, then disappears.
  // A session the admin marked `live` stays live past the 2h window — a long
  // hackathon evening ends when she marks it done, not when the clock says so.
  const stillLive = (past ?? []).filter((s) => s.status === "live" && !s.canceled_at);
  const upcoming = [
    ...stillLive,
    ...(upcomingRaw ?? []).filter(
      (s) => s.status !== "done" && (!s.canceled_at || new Date(s.canceled_at).getTime() > cutoff)
    ),
  ];
  const isLive = (s: { scheduled_at: string; canceled_at: string | null; status: string }) =>
    !s.canceled_at &&
    s.status !== "done" &&
    (s.status === "live" || new Date(s.scheduled_at).getTime() <= now.getTime());

  const pastShown = (past ?? []).filter((s) => !s.canceled_at && s.status !== "live");
  // "הועבר + כניסה מההקלטות": the link shows only when a recording actually
  // exists for that session — a dead "להקלטה" teaches her not to click it.
  const recTable = subscriber ? "recordings" : "recordings_public";
  const { data: recRows } = pastShown.length
    ? await supabase
        .from(recTable)
        .select("id, session_id")
        .in("session_id", pastShown.map((s) => s.id))
    : { data: [] };
  const recordedSessions = new Set((recRows ?? []).map((r) => r.session_id));

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
          upcoming.map((s) => {
            const live = isLive(s);
            return (
              <div
                key={s.id}
                className={
                  "bg-white border rounded-[18px] p-[18px] flex gap-4 items-center shadow-sm" +
                  (s.canceled_at
                    ? " opacity-60 border-ink-200"
                    : live
                      ? " border-brand-pink shadow-glow-pink"
                      : " border-ink-200")
                }
              >
                <div className="w-14 h-14 rounded-md bg-brand-gradient-soft flex flex-col items-center justify-center shrink-0">
                  <span className="font-display font-black text-lg text-ink-1000 leading-none">
                    {fmtIsraelDate(s.scheduled_at, { day: "numeric" })}
                  </span>
                  <span className="text-[10px] text-ink-500">
                    {fmtIsraelDate(s.scheduled_at, { month: "short" })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {s.topic && (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-tint-purple text-brand-purple mb-1">
                      {s.topic}
                    </span>
                  )}
                  <div className="font-display font-bold text-[15px] text-ink-1000 flex items-center gap-2 flex-wrap">
                    {s.title}
                    {live && (
                      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-black px-2 py-0.5 rounded-full bg-danger-bg text-danger">
                        <span className="relative flex w-2 h-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
                          <span className="relative inline-flex rounded-full w-2 h-2 bg-danger" />
                        </span>
                        LIVE עכשיו
                      </span>
                    )}
                    {s.canceled_at && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-danger-bg text-danger">בוטל</span>
                    )}
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={12} /> {fmtIsraelDate(s.scheduled_at)} · {fmtIsraelTime(s.scheduled_at)} (שעון ישראל)
                    </span>
                    <SessionFiles
                      syllabus={s.syllabus_url ?? null}
                      materials={materialsUrl(s)}
                      subscriber={subscriber}
                    />
                  </div>
                </div>
                {!s.canceled_at &&
                  (subscriber ? (
                    joinUrl(s) && (
                      <a
                        href={joinUrl(s)!}
                        className="inline-flex items-center gap-1.5 font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-brand-gradient text-white shrink-0"
                      >
                        <Video size={14} /> {live ? "מצטרפת עכשיו!" : "הצטרפות"}
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
            );
          })
        ) : (
          <div className="bg-white border border-ink-200 rounded-lg p-6 text-ink-700">
            אין סשנים מתוכננים כרגע — נעדכן אותך ברגע שנקבע משהו חדש.
          </div>
        )}
      </section>

      {pastShown.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold text-ink-1000">סשנים שעברו</h2>
          <div className="flex flex-col gap-2">
            {pastShown.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap"
              >
                <div className="text-ink-400 text-xs font-mono w-20 shrink-0">{fmtIsraelDate(s.scheduled_at, { day: "numeric", month: "short" })}</div>
                <div className="font-medium text-ink-900 flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                  <span>{s.title}</span>
                  {/* The topic carries the lecturer's name — it belongs here too. */}
                  {s.topic && (
                    <span className="inline-block text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-tint-purple text-brand-purple">
                      {s.topic}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-tint-mint text-success">
                    <Check size={10} /> הועבר
                  </span>
                </div>
                <SessionFiles
                  syllabus={s.syllabus_url ?? null}
                  materials={materialsUrl(s)}
                  subscriber={subscriber}
                />
                {recordedSessions.has(s.id) && (
                  <a href="/recordings" className="text-brand-purple text-sm font-semibold shrink-0">
                    {subscriber ? "לצפייה בהקלטה ←" : "להקלטות"}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
