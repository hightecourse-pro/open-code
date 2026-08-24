"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BookOpenText, CheckCircle2, ChevronDown, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { startCourse } from "@/app/(app)/courses/actions";
import type { Course } from "@/types/database";

const COVERS = [
  "bg-[linear-gradient(135deg,#E0418D,#913F80)]",
  "bg-[linear-gradient(135deg,#6B3D99,#464CA0)]",
  "bg-[linear-gradient(135deg,#1F1E3F,#464CA0)]",
  "bg-[linear-gradient(135deg,#464CA0,#6B3D99)]",
  "bg-[linear-gradient(135deg,#E0418D,#464CA0)]",
  "bg-[linear-gradient(135deg,#913F80,#E0418D)]",
];

const SWAP_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Jerusalem",
});

export interface CourseCardProps {
  course: Course;
  /** Year summary, e.g. "שנות הקורס: 2023–2025" (courses with units). */
  cycles?: string | null;
  /** Unit names+years — the "מה לומדים" syllabus peek (PM feedback). */
  syllabus?: { name: string; year: number | null }[];
  /** This is HER course this month — marked, never buttoned. */
  isActive?: boolean;
  /** True when another course (or a still-running month) blocks this one. */
  locked: boolean;
  /** Inside a locked month, her last take may be re-opened. */
  resume?: boolean;
  /**
   * When she is NOT yet allowed to swap: the ISO date her next swap unlocks —
   * printed on the card, per the owner's library rule. Null once eligible.
   */
  swapEligibleAt?: string | null;
  /** An admin opened this course for her personally — it isn't locked. */
  gifted?: boolean;
  /** True for a free member — the catalogue is visible, opening isn't. */
  needsSubscription?: boolean;
  onStartError?: (msg: string) => void;
}

export function CourseCard({
  course,
  cycles,
  syllabus = [],
  isActive = false,
  locked,
  resume = false,
  swapEligibleAt = null,
  gifted = false,
  needsSubscription = false,
}: CourseCardProps) {
  const [pending, start] = useTransition();
  const [showSyllabus, setShowSyllabus] = useState(false);
  const cover = COVERS[(course.cover_variant - 1) % COVERS.length];
  const swapReady = locked && !swapEligibleAt;

  function onStart() {
    start(async () => {
      const res = await startCourse(course.id);
      if (res?.error) alert(res.error);
    });
  }

  function onSwap() {
    if (!confirm(`להחליף לקורס "${course.title}"? הגישה לקורס הנוכחי תיסגר — כמו החזרת ספר לספרייה 📚`)) return;
    onStart();
  }

  return (
    <div
      className={cn(
        // h-full + flex column so every CTA in the grid row lands on the same
        // line, whatever the title/category above it does.
        "bg-white border rounded-[18px] overflow-hidden h-full flex flex-col transition-[transform,box-shadow] duration-[220ms]",
        isActive
          ? "border-brand-pink-deep shadow-glow-pink"
          : gifted
            ? "border-[#F3C6DD]"
            : "border-ink-200",
        locked && !gifted && !swapReady ? "opacity-70" : "hover:-translate-y-0.5 hover:shadow-md"
      )}
    >
      {/* The course NAME on the cover — a lone letter said nothing (PM). */}
      <div className={cn("h-[104px] shrink-0 relative flex items-center justify-center px-4 text-center", cover)}>
        <span className="text-white font-display font-black text-[19px] leading-snug line-clamp-2 drop-shadow-sm">
          {course.title}
        </span>
        {isActive && (
          <div className="absolute inset-x-0 bottom-0 bg-white/92 text-brand-pink-deep text-[12px] font-display font-bold py-1 text-center flex items-center justify-center gap-1">
            <CheckCircle2 size={13} /> הקורס שלך החודש
          </div>
        )}
        {gifted && !isActive && (
          <div className="absolute inset-x-0 bottom-0 bg-white/92 text-brand-pink-deep text-[12px] font-display font-semibold py-1 text-center">
            נפתח עבורך אישית 💜
          </div>
        )}
        {locked && !gifted && !swapReady && (
          // A bottom strip, not a full veil — the course name must stay
          // readable even while the month is locked.
          <div className="absolute inset-x-0 bottom-0 bg-ink-1000/75 text-white text-[11.5px] font-display font-semibold py-1 px-2 flex items-center justify-center gap-1.5">
            <Lock size={11} className="shrink-0" />
            נעול להחודש · זכאות החלפה מ-{SWAP_DATE.format(new Date(swapEligibleAt!))}
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        {course.category && (
          <div className="font-mono text-[11px] text-brand-pink-deep mb-1">{course.category}</div>
        )}
        <div className="text-[12.5px] text-ink-500 flex gap-2.5 flex-wrap">
          <span>{course.lessons_count} שיעורים</span>
          <span>·</span>
          {cycles ? <span>{cycles}</span> : <span>{course.duration_hours} שעות</span>}
        </div>

        {/* Syllabus peek — what's actually inside, before she commits. */}
        {syllabus.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowSyllabus((v) => !v)}
              aria-expanded={showSyllabus}
              className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-purple cursor-pointer"
            >
              <BookOpenText size={13} /> מה לומדים בקורס?
              <ChevronDown size={13} className={cn("transition-transform", showSyllabus && "rotate-180")} />
            </button>
            {showSyllabus && (
              <ul className="mt-1.5 flex flex-col gap-1 text-[12.5px] text-ink-700">
                {syllabus.map((u, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-brand-pink-deep">•</span>
                    {u.name}
                    {u.year ? <span className="text-ink-400">({u.year})</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* mt-auto on the wrapper (not on the CTA itself, whose own py-* would
            win the merge) is what lines the buttons up across the grid row. */}
        <div className="mt-auto pt-3">
          {isActive ? (
            <div className="w-full text-center font-display font-bold text-[13px] py-2 rounded-md bg-tint-pink text-brand-pink-deep flex items-center justify-center gap-1.5">
              <CheckCircle2 size={14} /> את לומדת אותו עכשיו — החומרים למעלה
            </div>
          ) : needsSubscription ? (
            <Link
              href="/join"
              className="w-full inline-flex items-center justify-center gap-1.5 font-display font-semibold text-[13px] py-2 rounded-md bg-white text-brand-purple border-[1.5px] border-brand-purple hover:bg-tint-purple transition-colors"
            >
              <Sparkles size={13} /> נפתח עם מנוי
            </Link>
          ) : gifted ? (
            <div className="text-[12.5px] text-ink-500">החומרים שלו מחכים לך למעלה 💜</div>
          ) : resume ? (
            <button
              type="button"
              onClick={onStart}
              disabled={pending}
              className="w-full font-display font-semibold text-[13px] py-2 rounded-md bg-brand-gradient text-white disabled:opacity-60"
            >
              {pending ? "פותח…" : "חזרה לקורס הזה 📚"}
            </button>
          ) : swapReady ? (
            <button
              type="button"
              onClick={onSwap}
              disabled={pending}
              className="w-full font-display font-semibold text-[13px] py-2 rounded-md bg-white text-brand-purple border-[1.5px] border-brand-purple hover:bg-tint-purple transition-colors disabled:opacity-60"
            >
              {pending ? "מחליפה…" : "החלפה לקורס הזה 📚"}
            </button>
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
