import type { Metadata } from "next";
import Link from "next/link";
import { Trash2, BookOpen, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ContentLinksEditor } from "@/components/patterns/content-links-editor";
import { Collapsible } from "@/components/patterns/collapsible";
import {
  createCourse,
  createSessionContent,
  deleteCourse,
  deleteSessionContent,
} from "./actions";
import type { ContentLink } from "@/types/database";

export const metadata: Metadata = { title: "ניהול תכנים" };

export default async function AdminContentPage() {
  const supabase = await createClient();
  const [{ data: courses }, { data: sessions }, { data: links }] = await Promise.all([
    supabase.from("courses").select("*").order("created_at", { ascending: false }),
    supabase.from("sessions").select("id, title, topic, scheduled_at").order("scheduled_at", { ascending: false }),
    supabase.from("content_links").select("*").order("sort_order", { ascending: true }),
  ]);

  const linksByOwner = new Map<string, ContentLink[]>();
  for (const l of links ?? []) {
    const key = `${l.owner_type}:${l.owner_id}`;
    const arr = linksByOwner.get(key) ?? [];
    arr.push(l);
    linksByOwner.set(key, arr);
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

        <Collapsible title="כל הקורסים" count={courses?.length ?? 0}>
          {(courses ?? []).map((c) => (
            <div key={c.id} className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="font-display font-bold text-ink-1000">{c.title}</div>
                {c.category && <span className="text-[11px] text-ink-400">{c.category}</span>}
                <form action={deleteCourse.bind(null, c.id)} className="ms-auto">
                  <button type="submit" className="text-ink-400 hover:text-danger flex items-center gap-1 text-xs">
                    <Trash2 size={14} /> מחיקת קורס
                  </button>
                </form>
              </div>
              <div className="text-[11px] text-ink-500 mb-3">
                {c.lessons_count} שיעורים · {c.duration_hours} שעות
              </div>
              <ContentLinksEditor ownerType="course" ownerId={c.id} links={linksByOwner.get(`course:${c.id}`) ?? []} />
            </div>
          ))}
          {(courses ?? []).length === 0 && <p className="text-ink-500 text-sm">אין קורסים עדיין — הוסיפי את הראשון 💜</p>}
        </Collapsible>
      </section>

      {/* ---------- Sessions ---------- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold text-ink-1000 flex items-center gap-2">
          <CalendarDays size={18} className="text-brand-purple" /> סשנים
        </h2>

        <form
          action={createSessionContent}
          className="bg-white border border-ink-200 rounded-[14px] p-3 flex flex-wrap items-center gap-2 shadow-sm"
        >
          <input name="title" placeholder="שם הסשן" required className="flex-1 min-w-[160px] text-sm border border-ink-300 rounded-md px-3 py-2" />
          <input name="topic" placeholder="נושא" className="text-sm border border-ink-300 rounded-md px-3 py-2 w-44" />
          <button type="submit" className="text-sm font-semibold text-white bg-brand-gradient rounded-md px-4 py-2">
            הוספת סשן
          </button>
        </form>

        {(sessions ?? []).map((s) => (
          <div key={s.id} className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="font-display font-bold text-ink-1000">{s.title}</div>
              {s.topic && <span className="text-[11px] text-ink-400">{s.topic}</span>}
              <form action={deleteSessionContent.bind(null, s.id)} className="ms-auto">
                <button type="submit" className="text-ink-400 hover:text-danger flex items-center gap-1 text-xs">
                  <Trash2 size={14} /> מחיקת סשן
                </button>
              </form>
            </div>
            <ContentLinksEditor ownerType="session" ownerId={s.id} links={linksByOwner.get(`session:${s.id}`) ?? []} />
          </div>
        ))}
        {(sessions ?? []).length === 0 && <p className="text-ink-500 text-sm">אין סשנים עדיין.</p>}
      </section>
    </div>
  );
}
