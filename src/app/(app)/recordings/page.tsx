import type { Metadata } from "next";
import Link from "next/link";
import { FileDown, Play, Video, ExternalLink, Hourglass, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser, isSubscriber, requireCommunityAccess } from "@/lib/auth";
import { mayOpenSessions } from "@/lib/content-access";
import { ContentGate } from "@/components/patterns/content-gate";
import { LoggedLink } from "@/components/patterns/logged-link";
import { SessionWatch } from "@/components/patterns/session-watch";
import { UpgradeCard } from "@/components/patterns/upgrade-prompt";
import { fmtIsraelDate } from "@/lib/utils";

export const metadata: Metadata = { title: "הקלטות סשנים" };

function minutes(sec: number): string {
  return `${Math.round(sec / 60)} דק'`;
}

/** Materials, like video URLs, exist only on the subscriber read. */
function materialsUrl(session: object): string | null {
  return (session as { materials_url?: string | null }).materials_url ?? null;
}

/** Present only on the subscriber read — the free view omits the column. */
function videoUrl(rec: object): string | null {
  return (rec as { video_url?: string | null }).video_url ?? null;
}

export default async function RecordingsPage() {
  const supabase = await createClient();
  const user = await getUser();
  const profile = await requireCommunityAccess();
  const subscriber = isSubscriber(profile);
  // Whose recordings these are: paying members, mentors and the team — the
  // same rule the Drive grant enforces, so the button never refuses her.
  const paysForSessions = mayOpenSessions(profile);

  // Free members read the sanitized views — no video URLs in them at all.
  const [{ data: recordings }, { data: doneSessions }, { data: myShares }] = await Promise.all([
    supabase
      .from(subscriber ? "recordings" : "recordings_public")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(60),
    supabase
      .from(subscriber ? "sessions" : "sessions_public")
      .select("*")
      .eq("status", "done")
      .eq("is_published", true)
      .order("scheduled_at", { ascending: false })
      .limit(60),
    // What she has ALREADY opened. Those sessions skip the gate entirely —
    // it costs her one press per session, ever.
    user
      ? supabase
          .from("content_shares")
          .select("owner_id")
          .eq("profile_id", user.id)
          .eq("owner_type", "session")
          .eq("status", "shared")
      : Promise.resolve({ data: [] }),
  ]);
  const unlockedSessions = new Set((myShares ?? []).map((s) => s.owner_id));

  // Finished sessions land here automatically, with their Drive video links
  // (from ניהול תכנים). Sessions already curated into `recordings` are skipped.
  const curatedSessionIds = new Set((recordings ?? []).map((r) => r.session_id).filter(Boolean));
  const sessions = (doneSessions ?? []).filter(
    (s) => !s.canceled_at && !curatedSessionIds.has(s.id)
  );
  // A session opened to the whole community is free — but "the community"
  // means an approved, live membership, the same floor `canAccess` applies
  // before it hands out a Drive permission. So a signup still waiting for
  // approval, and a member whose subscription ended, see the locked row rather
  // than a button that would refuse them.
  const inCommunity = profile.status === "active";
  const mayOpen = (s: { open_to_all: boolean }) =>
    paysForSessions || (inCommunity && s.open_to_all);
  // Drive links are paid material — never fetched for a free member.
  // A free member sees the recordings of sessions the team opened to the whole
  // community; everything else stays paid material. RLS enforces exactly the
  // same rule, so a hand-crafted request gets no more than this page shows.
  const readableSessions = subscriber ? sessions : sessions.filter(mayOpen);
  const openToAllCount = inCommunity ? sessions.filter((s) => s.open_to_all).length : 0;
  const { data: sessionLinks } = readableSessions.length
    ? await supabase
        .from("content_links")
        .select("*")
        .eq("owner_type", "session")
        .in("kind", ["video", "materials"])
        .in("owner_id", readableSessions.map((s) => s.id))
        .order("sort_order", { ascending: true })
    : { data: [] };
  const linksBySession = new Map<string, { id: string; title: string; url: string }[]>();
  const materialsBySession = new Map<string, { id: string; title: string; url: string }[]>();
  for (const l of sessionLinks ?? []) {
    const bucket = l.kind === "materials" ? materialsBySession : linksBySession;
    const arr = bucket.get(l.owner_id) ?? [];
    arr.push({ id: l.id, title: l.title, url: l.url });
    bucket.set(l.owner_id, arr);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;הקלטות/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">הקלטות סשנים</h1>
        <p className="t-body-sm text-ink-700">כל הסשנים הדו-שבועיים — זמינים לצפייה מתי שנוח לך.</p>
      </div>

      {!paysForSessions && (
        <UpgradeCard
          mentorWaiting={profile.role === "mentor"}
          title="הצפייה בהקלטות נפתחת עם מנוי"
          body={
            openToAllCount > 0
              ? "כמה סשנים פתחנו לכל הקהילה ואת מוזמנת לצפות בהם עכשיו. שאר ההקלטות נפתחות עם מנוי."
              : "כאן את רואה מה כבר נלמד בקהילה. עם מנוי כל ההקלטות נפתחות לצפייה מתי שנוח לך."
          }
        />
      )}

      {(sessions.length > 0 || (recordings?.length ?? 0) > 0) && (
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
                    {fmtIsraelDate(s.scheduled_at, { day: "numeric", month: "long" })}
                  </div>
                </div>
                {/* The syllabus is community-wide and survives the recording. */}
                {s.syllabus_url && (
                  <a
                    href={s.syllabus_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-purple hover:underline"
                  >
                    <FileDown size={13} /> סילבוס
                  </a>
                )}
                {!mayOpen(s) ? (
                  <Link
                    href="/join"
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-purple bg-white border-[1.5px] border-brand-purple rounded-md px-3.5 py-2 hover:bg-tint-purple transition-colors"
                  >
                    <Lock size={13} /> נפתח עם מנוי
                  </Link>
                ) : links.length > 0 || (materialsBySession.get(s.id)?.length ?? 0) > 0 || materialsUrl(s) ? (
                  // The first press opens her Drive access to this session's
                  // recordings; from then on the player is simply here.
                  <ContentGate
                    ownerType="session"
                    ownerId={s.id}
                    unlocked={unlockedSessions.has(s.id)}
                    variant="inline"
                    label="צפייה"
                  >
                    <div className="flex flex-col gap-2 w-full">
                      {links.length > 0 ? (
                        <SessionWatch sessionId={s.id} links={links.map((l) => ({ id: l.id, url: l.url }))} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-500">
                          <Hourglass size={13} /> ההקלטה תעלה בקרוב
                        </span>
                      )}
                      {((materialsBySession.get(s.id)?.length ?? 0) > 0 || materialsUrl(s)) && (
                        <span className="flex flex-wrap items-center gap-2 text-[12.5px]">
                          <span className="font-semibold text-ink-700">חומרים:</span>
                          {(materialsBySession.get(s.id) ?? []).map((m) => (
                            <a
                              key={m.id}
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-brand-purple bg-tint-purple border border-[#DDC9EC] rounded-md px-2.5 py-1 hover:bg-tint-indigo"
                            >
                              {m.title} <ExternalLink size={11} />
                            </a>
                          ))}
                          {materialsUrl(s) && (
                            <a
                              href={materialsUrl(s)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-brand-purple bg-tint-purple border border-[#DDC9EC] rounded-md px-2.5 py-1 hover:bg-tint-indigo"
                            >
                              חומרי הסשן <ExternalLink size={11} />
                            </a>
                          )}
                        </span>
                      )}
                    </div>
                  </ContentGate>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-500">
                    <Hourglass size={13} /> ההקלטה תעלה בקרוב
                  </span>
                )}
              </div>
            );
          })}

          {/* Curated recordings (the recordings table) — the SAME row shape
              as every other session (the owner, 30/8: "כל סשן אמור להיות
              שורה"), not a card grid. */}
          {(recordings ?? []).map((rec) => {
            const href = subscriber ? videoUrl(rec) ?? "#" : "/join";
            // These curated links live on `recordings.video_url`, not in
            // content_links — nothing to unlock; the entry is still logged.
            const watch =
              subscriber && rec.session_id ? (
                <LoggedLink
                  href={href}
                  ownerType="session"
                  ownerId={rec.session_id as string}
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-gradient rounded-md px-3.5 py-2"
                >
                  <Play size={13} fill="currentColor" /> צפייה <ExternalLink size={11} />
                </LoggedLink>
              ) : subscriber ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white bg-brand-gradient rounded-md px-3.5 py-2"
                >
                  <Play size={13} fill="currentColor" /> צפייה <ExternalLink size={11} />
                </a>
              ) : (
                <Link
                  href="/join"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-purple bg-white border-[1.5px] border-brand-purple rounded-md px-3.5 py-2 hover:bg-tint-purple transition-colors"
                >
                  <Lock size={13} /> נפתח עם מנוי
                </Link>
              );
            return (
              <div
                key={rec.id}
                className="bg-white border border-ink-200 rounded-[16px] p-4 flex items-center gap-3 shadow-sm flex-wrap"
              >
                <div className="w-10 h-10 rounded-md bg-brand-gradient-soft flex items-center justify-center shrink-0">
                  <Play size={17} className="text-brand-pink-deep" />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <div className="font-display font-bold text-[14.5px] text-ink-1000">{rec.title}</div>
                  <div className="text-xs text-ink-500 flex items-center gap-1.5 flex-wrap">
                    {rec.category && <span className="font-mono text-brand-pink-deep">{rec.category}</span>}
                    {rec.category && <span>·</span>}
                    <span>{minutes(rec.duration_sec)}</span>
                    {rec.is_free && (
                      <span className="bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        חינם
                      </span>
                    )}
                  </div>
                </div>
                {watch}
              </div>
            );
          })}
        </section>
      )}

      {sessions.length === 0 && (recordings?.length ?? 0) === 0 && (
        <div className="bg-white border border-ink-200 rounded-lg p-6 shadow-sm text-ink-700">
          עדיין אין הקלטות — הראשונות יחכו לך כאן בקרוב 💜
        </div>
      )}
    </div>
  );
}
