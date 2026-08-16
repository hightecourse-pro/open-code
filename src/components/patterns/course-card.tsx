"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { startCourse } from "@/app/(app)/courses/actions";
import type { Course } from "@/types/database";

const COVERS = [
  "bg-[linear-gradient(135deg,#E0418D,#913F80)]",
  "bg-[linear-gradient(135deg,#6B3D99,#464CA0)]",
  "bg-[linear-gradient(135deg,#1F1E3F,#464CA0)]",
  "bg-[linear-gradient(135deg,#36C57B,#28A864)]",
  "bg-[linear-gradient(135deg,#FFB85C,#E5A93C)]",
  "bg-[linear-gradient(135deg,#913F80,#E0418D)]",
];

export interface CourseCardProps {
  course: Course;
  /** Year-cycle summary, e.g. "3 מחזורים · 2023–2025" (courses with units). */
  cycles?: string | null;
  /** True when the member already has a different active course (locked). */
  locked: boolean;
  /** An admin opened this course for her personally — it isn't locked. */
  gifted?: boolean;
  /** True for a free member — the catalogue is visible, opening isn't. */
  needsSubscription?: boolean;
  onStartError?: (msg: string) => void;
}

export function CourseCard({
  course,
  cycles,
  locked,
  gifted = false,
  needsSubscription = false,
}: CourseCardProps) {
  const [pending, start] = useTransition();
  const cover = COVERS[(course.cover_variant - 1) % COVERS.length];

  function onStart() {
    start(async () => {
      const res = await startCourse(course.id);
      if (res?.error) alert(res.error);
    });
  }

  return (
    <div
      className={cn(
        // h-full + flex column so every CTA in the grid row lands on the same
        // line, whatever the title/category above it does.
        "bg-white border rounded-[18px] overflow-hidden h-full flex flex-col transition-[transform,box-shadow] duration-[220ms]",
        gifted ? "border-[#F3C6DD]" : "border-ink-200",
        locked && !gifted ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      <div className={cn("h-[120px] shrink-0 relative flex items-center justify-center text-white font-mono text-5xl font-black", cover)}>
        {course.title.slice(0, 1)}
        {gifted && (
          <div className="absolute inset-x-0 bottom-0 bg-white/92 text-brand-pink-deep text-[12px] font-display font-semibold py-1 text-center">
            נפתח עבורך אישית 💜
          </div>
        )}
        {locked && !gifted && (
          <div className="absolute inset-0 bg-ink-1000/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5 text-white text-[13px] font-display font-semibold">
            <Lock size={22} />
            יש לך קורס פעיל אחר
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        {course.category && (
          <div className="font-mono text-[11px] text-brand-pink-deep mb-1">{course.category}</div>
        )}
        <div className="font-display font-bold text-[15.5px] text-ink-1000 leading-tight mb-1">
          {course.title}
        </div>
        <div className="text-[12.5px] text-ink-500 flex gap-2.5 flex-wrap">
          <span>{course.lessons_count} שיעורים</span>
          {cycles ? (
            <>
              <span>·</span>
              <span>{cycles}</span>
            </>
          ) : (
            <>
              <span>·</span>
              <span>{course.duration_hours} שעות</span>
            </>
          )}
        </div>
        {/* mt-auto on the wrapper (not on the CTA itself, whose own py-* would
            win the merge) is what lines the buttons up across the grid row. */}
        <div className="mt-auto pt-3">
          {needsSubscription ? (
            <Link
              href="/join"
              className="w-full inline-flex items-center justify-center gap-1.5 font-display font-semibold text-[13px] py-2 rounded-md bg-white text-brand-purple border-[1.5px] border-brand-purple hover:bg-tint-purple transition-colors"
            >
              <Sparkles size={13} /> נפתח עם מנוי
            </Link>
          ) : gifted ? (
            <div className="text-[12.5px] text-ink-500">החומרים שלו מחכים לך למעלה 💜</div>
          ) : (
            !locked && (
              <button
                type="button"
                onClick={onStart}
                disabled={pending}
                className="w-full font-display font-semibold text-[13px] py-2 rounded-md bg-brand-gradient text-white disabled:opacity-60"
              >
                {pending ? "פותח…" : "התחילי קורס"}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
