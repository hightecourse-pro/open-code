import type { Metadata } from "next";
import { Info, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { CourseCard } from "@/components/patterns/course-card";
import { CourseContent } from "@/components/patterns/course-content";
import { returnCourse } from "./actions";
import type { ContentLink } from "@/types/database";

export const metadata: Metadata = { title: "ספריית הקורסים" };

export default async function CoursesPage() {
  const supabase = await createClient();
  const user = await getUser();

  const [{ data: courses }, { data: active }] = await Promise.all([
    supabase.from("courses").select("*").eq("is_published", true).order("created_at", { ascending: true }),
    user
      ? supabase
          .from("enrollments")
          .select("id, course_id, progress_pct, last_switch_month, studied, rating, feedback")
          .eq("profile_id", user.id)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const activeCourse = active ? (courses ?? []).find((c) => c.id === active.course_id) : null;

  // Load the active course's Drive links (videos + materials folders).
  let activeLinks: ContentLink[] = [];
  if (activeCourse) {
    const { data } = await supabase
      .from("content_links")
      .select("*")
      .eq("owner_type", "course")
      .eq("owner_id", activeCourse.id)
      .order("sort_order", { ascending: true });
    activeLinks = data ?? [];
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-xs text-brand-pink-deep">&lt;קורסים/&gt;</span>
        <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ספריית הקורסים</h1>
        <p className="t-body-sm text-ink-700">קורס פעיל אחד בכל פעם — כמו ספרייה. אפשר להחליף פעם בחודש.</p>
      </div>

      {activeCourse && (
        <div className="relative overflow-hidden bg-brand-gradient rounded-[22px] p-6 text-white shadow-glow-pink flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          <div className="w-[120px] h-[80px] rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0 border border-white/25">
            <Play size={28} fill="white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[11px] opacity-80">הקורס הפעיל שלך</div>
            <div className="font-display text-[22px] font-black my-1">{activeCourse.title}</div>
            <div className="text-[13px] opacity-85 mb-2">
              {activeCourse.instructor ? `עם ${activeCourse.instructor} · ` : ""}
              {activeCourse.lessons_count} שיעורים
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden max-w-[300px]">
              <div className="h-full bg-white rounded-full" style={{ width: `${active?.progress_pct ?? 0}%` }} />
            </div>
            <div className="text-xs opacity-85 mt-1.5">{active?.progress_pct ?? 0}% הושלמו</div>
          </div>
          <div className="flex flex-col gap-2 sm:ms-auto">
            <button className="font-display font-semibold text-[13.5px] px-[18px] py-2.5 rounded-md bg-white text-brand-pink-deep">
              המשך לקורס
            </button>
            <form action={returnCourse}>
              <button
                type="submit"
                className="w-full font-display font-semibold text-[13.5px] px-[18px] py-2.5 rounded-md bg-white/[0.18] text-white backdrop-blur"
              >
                החזרת קורס
              </button>
            </form>
          </div>
        </div>
      )}

      {activeCourse && (
        <CourseContent
          courseId={activeCourse.id}
          links={activeLinks}
          studied={active?.studied ?? false}
          rating={active?.rating ?? null}
          feedback={active?.feedback ?? null}
        />
      )}

      <div className="flex gap-2.5 items-start bg-tint-purple border border-[#DDC9EC] rounded-md p-3.5 px-4 text-[13.5px] text-ink-700">
        <Info size={18} className="text-brand-purple shrink-0 mt-0.5" />
        <span>
          <b className="font-display text-brand-purple">איך זה עובד:</b> את בוחרת קורס אחד ולומדת בקצב שלך.
          בכל חודש אפשר להחליף לקורס אחר — הקורס הקודם ייסגר ויפתח החדש.
        </span>
      </div>

      <h2 className="font-display text-lg font-bold text-ink-1000">כל הקורסים</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(courses ?? []).map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            locked={!!activeCourse && activeCourse.id !== course.id}
          />
        ))}
      </div>
    </div>
  );
}
