import type { Metadata } from "next";
import Link from "next/link";
import { Trash2, BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CourseUnitsEditor } from "@/components/patterns/course-units-editor";
import { Collapsible } from "@/components/patterns/collapsible";
import { createCourse, deleteCourse } from "./actions";
import type { ContentLink, CourseUnit } from "@/types/database";

export const metadata: Metadata = { title: "ניהול תכנים" };

export default async function AdminContentPage() {
  const supabase = await createClient();
  const [{ data: courses }, { data: links }, { data: units }] = await Promise.all([
    supabase.from("courses").select("*").order("created_at", { ascending: false }),
    supabase.from("content_links").select("*").order("sort_order", { ascending: true }),
    supabase.from("course_units").select("*").order("sort_order", { ascending: true }),
  ]);

  const linksByOwner = new Map<string, ContentLink[]>();
  for (const l of links ?? []) {
    const key = `${l.owner_type}:${l.owner_id}`;
    const arr = linksByOwner.get(key) ?? [];
    arr.push(l);
    linksByOwner.set(key, arr);
  }

  const unitsByCourse = new Map<string, CourseUnit[]>();
  for (const u of units ?? []) {
    const arr = unitsByCourse.get(u.course_id) ?? [];
    arr.push(u);
    unitsByCourse.set(u.course_id, arr);
  }
  const linksByUnit = new Map<string, ContentLink[]>();
  for (const l of links ?? []) {
    if (!l.unit_id) continue;
    const arr = linksByUnit.get(l.unit_id) ?? [];
    arr.push(l);
    linksByUnit.set(l.unit_id, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <span className="font-mono text-xs text-brand-pink-deep">&lt;תכנים/&gt;</span>
          <h1 className="font-display text-[28px] font-black text-ink-1000 mt-1">ניהול תכנים</h1>
          <p className="t-body-sm text-ink-500">
            כל קורס וסשן הם רשימת קישורים ב-Google Drive. סמני כל קישור כסרטון (צפייה בלבד) או כתיקיית חומרים.
          </p>
        </div>
        <Link href="/admin/shares" className="text-sm font-semibold text-brand-purple hover:underline">
          תור שיתופים אישיים ←
        </Link>
      </div>

      {/* ---------- Courses ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-ink-1000 flex items-center gap-2">
          <BookOpen size={18} className="text-brand-pink-deep" /> קורסים
        </h2>

        <form
          action={createCourse}
          className="bg-white border border-ink-200 rounded-[14px] p-3 flex flex-wrap items-center gap-2 shadow-sm"
        >
          <input name="title" placeholder="שם הקורס" required className="flex-1 min-w-[140px] text-sm border border-ink-300 rounded-md px-3 py-2" />
          <input name="category" placeholder="קטגוריה" className="text-sm border border-ink-300 rounded-md px-3 py-2 w-28" />
          <input name="instructor" placeholder="מנחה" className="text-sm border border-ink-300 rounded-md px-3 py-2 w-28" />
          <input name="lessons_count" type="number" min="0" placeholder="שיעורים" title="מספר שיעורים" className="text-sm border border-ink-300 rounded-md px-3 py-2 w-24" />
          <input name="duration_hours" type="number" min="0" placeholder="שעות" title="שעות" className="text-sm border border-ink-300 rounded-md px-3 py-2 w-20" />
          <button type="submit" className="text-sm font-semibold text-white bg-brand-gradient rounded-md px-4 py-2">
            הוספת קורס
          </button>
        </form>

        {/* Every course folds closed by default (Shira) — the header line
            still says what's inside, and deletion stays visible. */}
        {(courses ?? []).map((c) => (
          <div key={c.id} className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm">
            <Collapsible
              title={`${c.title}${c.category ? ` · ${c.category}` : ""} (${c.lessons_count} שיעורים${
                (unitsByCourse.get(c.id)?.length ?? 0) > 0
                  ? `, ${unitsByCourse.get(c.id)!.length} קוביות`
                  : ""
              })`}
              defaultOpen={false}
            >
              <div className="flex items-center">
                <form action={deleteCourse.bind(null, c.id)} className="ms-auto">
                  <button type="submit" className="text-ink-400 hover:text-danger flex items-center gap-1 text-xs">
                    <Trash2 size={14} /> מחיקת קורס
                  </button>
                </form>
              </div>
              <CourseUnitsEditor
                courseId={c.id}
                units={unitsByCourse.get(c.id) ?? []}
                linksByUnit={linksByUnit}
                unassigned={(linksByOwner.get(`course:${c.id}`) ?? []).filter((l) => !l.unit_id)}
              />
            </Collapsible>
          </div>
        ))}
        {(courses ?? []).length === 0 && <p className="text-ink-500 text-sm">אין קורסים עדיין — הוסיפי את הראשון 💜</p>}
      </section>

      {/* Session content moved to ניהול סשנים (the owner, 30/8) — one home
          per session: recording, syllabus upload, materials, pre-topics. */}
      <p className="text-[13px] text-ink-500 bg-ink-50 border border-ink-200 rounded-md px-4 py-3">
        תכני הסשנים (הקלטה, סילבוס, חומרים ונושאים) מנוהלים עכשיו במסך{" "}
        <a href="/admin/sessions" className="font-semibold text-brand-purple hover:underline">
          ניהול סשנים
        </a>{" "}
        — על כל סשן, בכפתור התיקייה.
      </p>
    </div>
  );
}
