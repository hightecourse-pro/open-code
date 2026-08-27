import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ContentOpenStat } from "@/types/database";
import { CoursesStatsTable, SessionsStatsTable } from "./stats-tables";

export const metadata: Metadata = { title: "אנליטיקת למידה" };


export default async function AdminAnalyticsPage() {
  const supabase = await createClient();

  const [{ data: courses }, { data: enrollments }, { data: sessions }] = await Promise.all([
    supabase.from("courses").select("id, title").order("title"),
    supabase.from("enrollments").select("profile_id, course_id, rating, studied, feedback"),
    supabase
      .from("sessions")
      .select("id, title, scheduled_at, open_to_all")
      .order("scheduled_at", { ascending: false }),
  ]);

  // Entries, already rolled up per member × content by the database view.
  // Before supabase/_content_access_log.sql runs the view doesn't exist — the
  // screen then falls back to the old link-level count for courses and says so.
  const { data: statRows, error: statsErr } = await supabase
    .from("content_open_stats")
    .select("profile_id, owner_type, owner_id, opens, first_open, last_open");
  const logReady = !statsErr;
  let stats: ContentOpenStat[] = statRows ?? [];

  if (!logReady) {
    const [{ data: links }, { data: views }] = await Promise.all([
      supabase.from("content_links").select("id, owner_id, owner_type"),
      supabase.from("content_views").select("link_id, profile_id, created_at"),
    ]);
    const linkOwner = new Map((links ?? []).map((l) => [l.id, l]));
    const acc = new Map<string, ContentOpenStat>();
    for (const v of views ?? []) {
      const owner = v.link_id ? linkOwner.get(v.link_id) : null;
      if (!owner) continue;
      const key = `${v.profile_id}:${owner.owner_type}:${owner.owner_id}`;
      const row = acc.get(key);
      if (row) {
        row.opens += 1;
        if (v.created_at < row.first_open) row.first_open = v.created_at;
        if (v.created_at > row.last_open) row.last_open = v.created_at;
      } else {
        acc.set(key, {
          profile_id: v.profile_id,
          owner_type: owner.owner_type,
          owner_id: owner.owner_id,
          opens: 1,
          first_open: v.created_at,
          last_open: v.created_at,
        });
      }
    }
    stats = [...acc.values()];
  }

  /** owner_id → { opens, members, last } for one kind of content. */
  function rollup(ownerType: "course" | "session") {
    const out = new Map<string, { opens: number; members: Set<string>; last: string }>();
    for (const s of stats) {
      if (s.owner_type !== ownerType) continue;
      const cur = out.get(s.owner_id) ?? { opens: 0, members: new Set<string>(), last: "" };
      cur.opens += s.opens;
      cur.members.add(s.profile_id);
      if (s.last_open > cur.last) cur.last = s.last_open;
      out.set(s.owner_id, cur);
    }
    return out;
  }
  const byCourse = rollup("course");
  const bySession = rollup("session");

  // A משוב without a name is unusable — an admin needs to know who to answer.
  // Only the members who actually wrote something are looked up.
  const commenterIds = [
    ...new Set((enrollments ?? []).filter((e) => e.feedback?.trim()).map((e) => e.profile_id)),
  ];
  const { data: commenters } = commenterIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", commenterIds)
    : { data: [] };
  const nameOf = new Map((commenters ?? []).map((p) => [p.id, p.full_name]));

  const courseStats = (courses ?? []).map((c) => {
    const es = (enrollments ?? []).filter((e) => e.course_id === c.id);
    const ratings = es.map((e) => e.rating).filter((r): r is number => typeof r === "number");
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    const opens = byCourse.get(c.id);
    return {
      id: c.id,
      title: c.title,
      enrollments: es.length,
      studied: es.filter((e) => e.studied).length,
      avgRating: avg,
      views: opens?.opens ?? 0,
      members: opens?.members.size ?? 0,
      last: opens?.last ?? null,
    };
  });

  // Only sessions anyone actually entered — the full list would be mostly
  // zeroes and would bury the ones that matter.
  const sessionStats = (sessions ?? [])
    .map((s) => ({ ...s, opens: bySession.get(s.id) }))
    .filter((s) => s.opens)
    .map((s) => ({
      id: s.id,
      title: s.title,
      scheduledAt: s.scheduled_at,
      openToAll: s.open_to_all,
      views: s.opens?.opens ?? 0,
      members: s.opens?.members.size ?? 0,
      last: s.opens?.last ?? null,
    }));

  // ── the summary FIRST (the PM), the detail after ──────────────────────────
  const allLearners = new Set(stats.map((s) => s.profile_id));
  const totalOpens = stats.reduce((n, s) => n + s.opens, 0);
  const topCourse = [...courseStats].sort((a, b) => b.views - a.views)[0];
  const topSession = [...sessionStats].sort((a, b) => b.views - a.views)[0];
  const summary = [
    { label: "לומדות פעילות", value: allLearners.size },
    { label: "סה״כ כניסות לתוכן", value: totalOpens },
    { label: "הקורס הנצפה ביותר", value: topCourse && topCourse.views > 0 ? topCourse.title : "—" },
    { label: "הסשן הנצפה ביותר", value: topSession ? topSession.title : "—" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;אנליטיקה/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">אנליטיקת למידה</h1>
        <p className="t-body-sm text-ink-700">
          מי נכנסה לאיזה תוכן ומתי — קורסים והקלטות סשנים כאחד. הדירוגים והמשובים מתמלאים כשחברה
          מסמנת שלמדה קורס ומשאירה משוב במסך הקורס.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {summary.map((s) => (
          <div key={s.label} className="bg-white border border-ink-200 rounded-2xl p-4 px-[18px]">
            <div className="text-xs text-ink-500 tracking-[0.04em] uppercase font-semibold">{s.label}</div>
            <div className="font-display font-black text-[20px] text-ink-1000 mt-1 truncate" title={String(s.value)}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {!logReady && (
        <div className="bg-tint-warm border border-[#F0DCA8] rounded-md p-3.5 px-4 text-[13.5px] text-[#8C5E0E]">
          <b className="font-display">התיעוד המלא עוד לא פעיל.</b> כאן רואים בינתיים רק צפיות
          בסרטוני קורסים, לפי קישור. אחרי הרצת{" "}
          <span className="font-mono text-[12px]" dir="ltr">
            supabase/_content_access_log.sql
          </span>{" "}
          ייכנסו לכאן גם הכניסות להקלטות הסשנים וגם &quot;כמה חברות&quot;.
        </div>
      )}

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm overflow-x-auto">
        <h3 className="font-display text-base font-bold mb-3">קורסים</h3>
        {courseStats.length > 0 ? (
          <CoursesStatsTable rows={courseStats} />
        ) : (
          <p className="text-ink-500 text-sm py-4">אין עדיין קורסים. הוסיפי קורסים בניהול הקורסים.</p>
        )}
      </div>

      {/* The half that never existed until now: who watched which recording. */}
      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm overflow-x-auto">
        <h3 className="font-display text-base font-bold mb-1">צפיות בהקלטות סשנים</h3>
        <p className="text-[12.5px] text-ink-500 mb-3">
          כל סשן שנכנסו אליו לפחות פעם אחת. 40 כניסות של חברה אחת זה לא 40 של ארבעים.
        </p>
        {sessionStats.length > 0 ? (
          <SessionsStatsTable rows={sessionStats} />
        ) : (
          <p className="text-ink-500 text-sm py-4">
            עדיין אף אחת לא נכנסה להקלטה. ברגע שמישהי תצפה, זה יופיע כאן 💜
          </p>
        )}
      </div>

      {(() => {
        const titleOf = new Map((courses ?? []).map((c) => [c.id, c.title]));
        const comments = (enrollments ?? [])
          .filter((e) => e.feedback && e.feedback.trim())
          .map((e) => ({
            profileId: e.profile_id,
            member: nameOf.get(e.profile_id) ?? "חברת קהילה",
            course: titleOf.get(e.course_id) ?? "—",
            rating: e.rating,
            text: e.feedback as string,
          }));
        if (comments.length === 0) return null;
        return (
          <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
            <h3 className="font-display text-base font-bold mb-3">משובים מהחברות</h3>
            <div className="flex flex-col gap-3">
              {comments.map((c) => (
                <div
                  key={`${c.profileId}-${c.course}`}
                  className="border-b border-ink-100 last:border-b-0 pb-3 last:pb-0"
                >
                  <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5">
                    <Link
                      href={`/admin/members/${c.profileId}`}
                      className="font-semibold text-ink-900 hover:text-brand-purple hover:underline"
                    >
                      {c.member}
                    </Link>
                    <span>·</span>
                    <span className="font-medium text-ink-700">{c.course}</span>
                    {c.rating != null && <span>{"⭐".repeat(c.rating)}</span>}
                  </div>
                  <p className="text-sm text-ink-900">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
