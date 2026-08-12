import { Trash2, Plus, Layers } from "lucide-react";
import { ContentLinksEditor } from "@/components/patterns/content-links-editor";
import {
  createCourseUnit,
  deleteCourseUnit,
  updateCourseUnit,
} from "@/app/(admin)/admin/content/actions";
import type { ContentLink, CourseUnit } from "@/types/database";

/**
 * Admin editor for a course's units (קוביות) — one year-cycle each, with its
 * own recordings and materials. A course with no units keeps its links flat,
 * so nothing forces the older courses into the new shape.
 */
export function CourseUnitsEditor({
  courseId,
  units,
  linksByUnit,
  unassigned,
}: {
  courseId: string;
  units: CourseUnit[];
  linksByUnit: Map<string, ContentLink[]>;
  /** Links on this course that belong to no unit (older courses). */
  unassigned: ContentLink[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {units.map((u) => {
        const links = linksByUnit.get(u.id) ?? [];
        const videos = links.filter((l) => l.kind === "video").length;
        const materials = links.filter((l) => l.kind === "materials").length;
        return (
          <div key={u.id} className="border border-ink-200 rounded-[14px] bg-ink-50/50 p-3.5">
            <div className="flex items-start gap-2 flex-wrap mb-2">
              <Layers size={15} className="text-brand-purple shrink-0 mt-1.5" />
              <form
                action={updateCourseUnit.bind(null, u.id)}
                className="flex items-center gap-1.5 flex-wrap flex-1 min-w-[220px]"
              >
                <input
                  name="name"
                  defaultValue={u.name}
                  required
                  className="flex-1 min-w-[140px] text-[13px] font-semibold border border-ink-300 rounded-md px-2 py-1.5 bg-white"
                />
                <input
                  name="year"
                  type="number"
                  min="2000"
                  max="2100"
                  defaultValue={u.year ?? ""}
                  placeholder="שנה"
                  className="w-[76px] text-[13px] border border-ink-300 rounded-md px-2 py-1.5 bg-white"
                />
                <button
                  type="submit"
                  className="text-[12px] font-semibold text-brand-purple hover:underline px-1"
                >
                  שמירה
                </button>
              </form>
              <span className="text-[11px] text-ink-400 mt-2">
                {videos} סרטונים · {materials} תיקיות
              </span>
              <form action={deleteCourseUnit.bind(null, u.id)} className="ms-auto mt-1.5">
                <button
                  type="submit"
                  title="מחיקת הקוביה והקישורים שבה"
                  className="text-ink-400 hover:text-danger flex items-center gap-1 text-[11.5px]"
                >
                  <Trash2 size={13} /> מחיקת קוביה
                </button>
              </form>
            </div>
            <ContentLinksEditor ownerType="course" ownerId={courseId} unitId={u.id} links={links} />
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div className="border border-dashed border-ink-300 rounded-[14px] p-3.5">
          <div className="text-[12px] text-ink-500 mb-2">
            {units.length > 0
              ? "קישורים שלא שויכו לאף קוביה — הם עדיין מוצגים למשתתפות."
              : "קישורי הקורס"}
          </div>
          <ContentLinksEditor ownerType="course" ownerId={courseId} links={unassigned} />
        </div>
      )}

      <form
        action={createCourseUnit.bind(null, courseId)}
        className="flex flex-wrap items-center gap-2 pt-1"
      >
        <input
          name="name"
          placeholder="שם הקוביה (למשל: אנגולר 18 מתקדמים)"
          required
          className="flex-1 min-w-[200px] text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
        />
        <input
          name="year"
          type="number"
          min="2000"
          max="2100"
          placeholder="שנה"
          className="w-[86px] text-[12px] border border-ink-300 rounded-md px-2 py-1.5"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-white bg-brand-gradient rounded-md px-3 py-1.5"
        >
          <Plus size={13} /> הוספת קוביה
        </button>
      </form>
    </div>
  );
}
