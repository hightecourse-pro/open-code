import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CoursesStatsTable, SessionsStatsTable } from "./stats-tables";

export const metadata: Metadata = { title: "אנליטיקת למידה" };


export default async function AdminAnalyticsPage() {
  const supabase = await createClient();

  const [{ data: courses }, { data: enrollments }, { data: extraFb }, { data: sessions }] = await Promise.all([
    supabase.from("courses").select("id, title").order("title"),
    supabase.from("enrollments").select("profile_id, course_id, rating, studied, feedback"),
    // Feedback that has no enrollment behind it (admins, gifted courses).
    supabase.from("course_feedback").select("profile_id, course_id, rating, feedback"),
    supabase
      .from("sessions")
      .select("id, title, scheduled_at, open_to_all")
      .order("scheduled_at", { ascending: false }),
  ]);

  // Totals aggregated in the DATABASE (2026-08-29): content_views grows with
  // every open forever — shipping member×content rows to this page stopped
  // scaling (and silently truncated at 1000 rows).
  const adminClient = createAdminClient();
  const [{ data: ownerTotals }, { data: summaryRows }] = await Promise.all([
    adminClient.rpc("analytics_owner_totals"),
    adminClient.rpc("analytics_summary"),
  ]);

  /** owner_id → totals for one kind of content, straight from the aggregate. */
  function rollup(ownerType: "course" | "session") {
    const out = new Map<string, { opens: number; members: number; last: string | null }>();
    for (const r of ownerTotals ?? []) {
      if (r.owner_type !== ownerType) continue;
      out.set(r.owner_id, { opens: Number(r.opens), members: Number(r.uniques), last: r.last_open });
    }
    return out;
  }
  const byCourse = rollup("course");
  const bySession = rollup("session");

  // A משוב without a name is unusable — an admin needs to know who to answer.
  // Only the members who actually wrote something are looked up.
  // One merged feedback set: course_feedback wins per (member, course); the
  // enrollments copy fills anything predating the table.
  const fbKey = (r: { profile_id: string; course_id: string }) => `${r.profile_id}:${r.course_id}`;
  const mergedFb = new Map<string, { profile_id: string; course_id: string; rating: number | null; feedback: string | null }>();
  for (const e of enrollments ?? []) {
    if (e.rating != null || e.feedback?.trim()) {
      mergedFb.set(fbKey(e), { profile_id: e.profile_id, course_id: e.course_id, rating: e.rating, feedback: e.feedback });
    }
  }
  for (const f of extraFb ?? []) mergedFb.set(fbKey(f), f);
  const allFb = [...mergedFb.values()];

  // Names for EVERY feedback row — a stars-only rating is listed per course
  // too (30/8), and an admin needs to know whose it is.
  const commenterIds = [...new Set(allFb.map((e) => e.profile_id))];
  const { data: commenters } = commenterIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", commenterIds)
    : { data: [] };
  const nameOf = new Map((commenters ?? []).map((p) => [p.id, p.full_name]));

  const courseStats = (courses ?? []).map((c) => {
    const es = (enrollments ?? []).filter((e) => e.course_id === c.id);
    const fbRows = allFb.filter((e) => e.course_id === c.id && (e.rating != null || e.feedback?.trim()));
    const ratings = fbRows.map((e) => e.rating).filter((r): r is number => typeof r === "number");
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    const opens = byCourse.get(c.id);
    return {
      id: c.id,
      title: c.title,
      enrollments: es.length,
      studied: es.filter((e) => e.studied).length,
      avgRating: avg,
      views: opens?.opens ?? 0,
      members: opens?.members ?? 0,
      last: opens?.last ?? null,
      // The feedback opens INSIDE the course row (the owner, 30/8).
      feedback: fbRows.map((e) => ({
        profileId: e.profile_id,
        name: nameOf.get(e.profile_id) ?? "חברת קהילה",
        rating: e.rating,
        text: e.feedback,
      })),
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
      members: s.opens?.members ?? 0,
      last: s.opens?.last ?? null,
    }));

  // ── the summary FIRST (the PM), the detail after ──────────────────────────
  const summaryRow = (summaryRows ?? [])[0];
  const allLearnersCount = Number(summaryRow?.active_learners ?? 0);
  const totalOpens = Number(summaryRow?.total_opens ?? 0);
  const topCourse = [...courseStats].sort((a, b) => b.views - a.views)[0];
  const topSession = [...sessionStats].sort((a, b) => b.views - a.views)[0];
  const summary = [
    { label: "לומדות פעילות", value: allLearnersCount },
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
    </div>
  );
}
