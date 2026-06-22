import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "אנליטיקת למידה" };

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();

  const [{ data: courses }, { data: enrollments }, { data: links }, { data: views }] =
    await Promise.all([
      supabase.from("courses").select("id, title").order("title"),
      supabase.from("enrollments").select("course_id, rating, studied, feedback"),
      supabase.from("content_links").select("id, owner_id").eq("owner_type", "course").eq("kind", "video"),
      supabase.from("content_views").select("link_id"),
    ]);

  // Aggregate per course (small data set; fine in-memory).
  const linkToCourse = new Map((links ?? []).map((l) => [l.id, l.owner_id]));
  const viewsByCourse = new Map<string, number>();
  for (const v of views ?? []) {
    const cid = linkToCourse.get(v.link_id);
    if (cid) viewsByCourse.set(cid, (viewsByCourse.get(cid) ?? 0) + 1);
  }

  const stats = (courses ?? []).map((c) => {
    const es = (enrollments ?? []).filter((e) => e.course_id === c.id);
    const ratings = es.map((e) => e.rating).filter((r): r is number => typeof r === "number");
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
    return {
      id: c.id,
      title: c.title,
      enrollments: es.length,
      studied: es.filter((e) => e.studied).length,
      avgRating: avg,
      views: viewsByCourse.get(c.id) ?? 0,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;אנליטיקה/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">אנליטיקת למידה</h1>
        <p className="t-body-sm text-ink-700">דירוגים, צפיות והשלמות לפי קורס.</p>
      </div>

      <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm overflow-x-auto">
        {stats.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-500 text-xs text-right border-b border-ink-100">
                <th className="py-2 font-semibold">קורס</th>
                <th className="py-2 font-semibold">נרשמו</th>
                <th className="py-2 font-semibold">סיימו</th>
                <th className="py-2 font-semibold">דירוג ממוצע</th>
                <th className="py-2 font-semibold">צפיות</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-b border-ink-100 last:border-b-0">
                  <td className="py-2.5 font-medium text-ink-900">{s.title}</td>
                  <td className="py-2.5">{s.enrollments}</td>
                  <td className="py-2.5">{s.studied}</td>
                  <td className="py-2.5">{s.avgRating != null ? `${s.avgRating.toFixed(1)} ⭐` : "—"}</td>
                  <td className="py-2.5">{s.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-ink-500 text-sm py-4">אין עדיין קורסים. הוסיפי קורסים בניהול הקורסים.</p>
        )}
      </div>

      {(() => {
        const titleOf = new Map((courses ?? []).map((c) => [c.id, c.title]));
        const comments = (enrollments ?? [])
          .filter((e) => e.feedback && e.feedback.trim())
          .map((e) => ({ course: titleOf.get(e.course_id) ?? "—", rating: e.rating, text: e.feedback as string }));
        if (comments.length === 0) return null;
        return (
          <div className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
            <h3 className="font-display text-base font-bold mb-3">משובים מהחברות</h3>
            <div className="flex flex-col gap-3">
              {comments.map((c, i) => (
                <div key={i} className="border-b border-ink-100 last:border-b-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5">
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
