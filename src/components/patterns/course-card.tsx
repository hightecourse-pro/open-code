"use client";

import { useTransition } from "react";
import { Lock } from "lucide-react";
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
  /** True when the member already has a different active course (locked). */
  locked: boolean;
  onStartError?: (msg: string) => void;
}

export function CourseCard({ course, locked }: CourseCardProps) {
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
        "bg-white border border-ink-200 rounded-[18px] overflow-hidden transition-[transform,box-shadow] duration-[220ms]",
        locked ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      <div className={cn("h-[120px] relative flex items-center justify-center text-white font-mono text-5xl font-black", cover)}>
        {course.title.slice(0, 1)}
        {locked && (
          <div className="absolute inset-0 bg-ink-1000/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5 text-white text-[13px] font-display font-semibold">
            <Lock size={22} />
            קורס פעיל אחר
          </div>
        )}
      </div>
      <div className="p-4">
        {course.category && (
          <div className="font-mono text-[11px] text-brand-pink-deep mb-1">{course.category}</div>
        )}
        <div className="font-display font-bold text-[15.5px] text-ink-1000 leading-tight mb-1">
          {course.title}
        </div>
        <div className="text-[12.5px] text-ink-500 flex gap-2.5">
          <span>{course.lessons_count} שיעורים</span>
          <span>·</span>
          <span>{course.duration_hours} שעות</span>
        </div>
        {!locked && (
          <button
            type="button"
            onClick={onStart}
            disabled={pending}
            className="mt-3 w-full font-display font-semibold text-[13px] py-2 rounded-md bg-brand-gradient text-white disabled:opacity-60"
          >
            {pending ? "פותחת…" : "התחילי קורס"}
          </button>
        )}
      </div>
    </div>
  );
}
