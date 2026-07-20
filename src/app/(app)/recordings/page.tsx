import type { Metadata } from "next";
import Link from "next/link";
import { Play, Video, ExternalLink, Hourglass, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { UpgradeCard } from "@/components/patterns/upgrade-prompt";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "הקלטות סשנים" };

const COVERS = [
  "bg-[linear-gradient(135deg,#E0418D,#913F80)]",
  "bg-[linear-gradient(135deg,#6B3D99,#464CA0)]",
  "bg-[linear-gradient(135deg,#1F1E3F,#464CA0)]",
  "bg-[linear-gradient(135deg,#36C57B,#28A864)]",
  "bg-[linear-gradient(135deg,#FFB85C,#E5A93C)]",
  "bg-[linear-gradient(135deg,#913F80,#E0418D)]",
];

function minutes(sec: number): string {
  return `${Math.round(sec / 60)} דק'`;
}

/** Present only on the subscriber read — the free view omits the column. */
function videoUrl(rec: object): string | null {
  return (rec as { video_url?: string | null }).video_url ?? null;
}

export default async function RecordingsPage() {
  const supabase = await createClient();
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);

  // Free members read the sanitized views — no video URLs in them at all.
  const [{ data: recordings }, { data: doneSessions }] = await Promise.all([
    supabase
      .from(subscriber ? "recordings" : "recordings_public")
      .select("*")
      .order("published_at", { ascending: false }),
    supabase
      .from(subscriber ? "sessions" : "sessions_public")
      .select("*")
      .eq("status", "done")
      .eq("is_published", true)
      .order("scheduled_at", { ascending: false }),
  ]);

  // Finished sessions land here automatically, with their Drive video links
  // (from ניהול תכנים). Sessions already curated into `recordings` are skipped.
  const curatedSessionIds = new Set((recordings ?? []).map((r) => r.session_id).filter(Boolean));
  const sessions = (doneSessions ?? []).filter(
    (s) => !s.canceled_at && !curatedSessionIds.has(s.id)
  );
  // Drive links are paid material — never fetched for a free member.
  const { data: sessionLinks } = subscriber && sessions.length
    ? await supabase
        .from("content_links")
        .select("*")
        .eq("owner_type", "session")
        .eq("kind", "video")
        .in("owner_id", sessions.map((s) => s.id))
        .order("sort_order", { ascending: true })
    : { data: [] };
  const linksBySession = new Map<string, { title: string; url: string }[]>();
  for (const l of sessionLinks ?? []) {
    const arr = linksBySession.get(l.owner_id) ?? [];
    arr.push({ title: l.title, url: l.url });
    linksBySession.set(l.owner_id, arr);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;הקלטות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">הקלטות סשנים</h1>
        <p className="t-body-sm text-ink-700">כל הסשנים השבועיים — זמינים לצפייה מתי שנוח לך.</p>
      </div>

      {!subscriber && (
        <UpgradeCard
          title="הצפייה בהקלטות נפתחת עם מנוי"
          body="כאן את רואה מה כבר נלמד בקהילה. עם מנוי כל ההקלטות נפתחות לצפייה מתי שנוח לך."
        />
      )}

      {sessions.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-lg font-bold text-ink-1000">סשנים שהסתיימו</h2>
          {sessions.map((s) => {
            const links = linksBySession.get(s.id) ?? [];
            return (
              <div
                key={s.id}
                className="bg-white border border-ink-200 rounded-[16px] p-4 flex items-center gap-3 shadow-sm flex-wrap"
              >
                <div className="w-10 h-10 rounded-md bg-brand-gradient-soft flex items-center justify-center shrink-0">
                  <Video size={17} className="text-brand-pink-deep" />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <div className="font-display font-bold text-[14.5px] text-ink-1000">{s.title}</div>
                  <div className="text-xs text-ink-500">
                    {s.topic ? `${s.topic} · ` : ""}
                    {new Date(s.scheduled_at).toLocaleDateString("he-IL", { day: "numeric", month: "long" })}
                  </div>
                </div>
                {!subscriber ? (
                  <Link
                    href="/join"
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-purple bg-white border-[1.5px] border-brand-purple rounded-md px-3.5 py-2 hover:bg-tint-purple transition-colors"
                  >
                    <Lock size={13} /> נפתח עם מנוי
                  </Link>
                ) : links.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {links.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-gradient rounded-md px-3.5 py-2"
                      >
                        <Play size={13} fill="currentColor" /> {l.title} <ExternalLink size={11} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-500">
                    <Hourglass size={13} /> ההקלטה תעלה בקרוב
                  </span>
                )}
              </div>
            );
          })}
        </section>
      )}

      {recordings && recordings.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {recordings.map((rec) => {
            const cover = COVERS[(rec.cover_variant - 1) % COVERS.length];
            return (
              <a
                key={rec.id}
                href={subscriber ? videoUrl(rec) ?? "#" : "/join"}
                title={subscriber ? undefined : "הצפייה נפתחת עם מנוי"}
                className="bg-white border border-ink-200 rounded-2xl overflow-hidden transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className={cn("h-24 relative flex items-center justify-center", cover)}>
                  <div className="w-[42px] h-[42px] rounded-full bg-white/90 flex items-center justify-center text-brand-pink-deep shadow-md">
                    {subscriber ? (
                      <Play size={18} fill="currentColor" className="ms-0.5" />
                    ) : (
                      <Lock size={17} />
                    )}
                  </div>
                  <span className="absolute bottom-2 left-2 bg-ink-1000/80 text-white text-[10.5px] font-mono px-1.5 py-0.5 rounded">
                    {minutes(rec.duration_sec)}
                  </span>
                  {rec.is_free && (
                    <span className="absolute top-2 right-2 bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      חינם
                    </span>
                  )}
                </div>
                <div className="p-3.5">
                  {rec.category && (
                    <div className="font-mono text-[10.5px] text-brand-pink-deep">{rec.category}</div>
                  )}
                  <div className="font-display font-bold text-sm text-ink-1000 leading-tight my-0.5">
                    {rec.title}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          עדיין אין הקלטות — הראשונות יחכו לך כאן בקרוב 💜
        </div>
      ) : null}
    </div>
  );
}
