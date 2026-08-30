"use client";

import { useState, useTransition } from "react";
import { Video, FolderOpen, ExternalLink, Check, ChevronDown, Star, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { driveEmbedUrl } from "@/lib/drive";
import { setStudied, saveCourseFeedback } from "@/app/(app)/courses/actions";
import { logContentOpen } from "@/app/(app)/content/actions";
import { ContentGate } from "@/components/patterns/content-gate";
import type { ContentLink } from "@/types/database";

/** A course unit (קוביה) — one year-cycle with its recordings and materials. */
export interface CourseUnitContent {
  id: string;
  name: string;
  year: number | null;
  links: ContentLink[];
}

export interface CourseContentProps {
  courseId: string;
  links: ContentLink[];
  /** When present, links render grouped into unit cards; legacy courses pass none. */
  units?: CourseUnitContent[];
  studied: boolean;
  rating: number | null;
  feedback: string | null;
  /**
   * She already holds a live Drive share for this course. False → the material
   * is behind one "צפייה" press, which is what actually opens it in Drive.
   */
  unlocked?: boolean;
}

export function CourseContent({
  courseId,
  links,
  units,
  studied,
  rating,
  feedback,
  unlocked = false,
}: CourseContentProps) {
  const videos = links.filter((l) => l.kind === "video");
  const materials = links.filter((l) => l.kind === "materials");

  const [done, setDone] = useState(studied);
  const [stars, setStars] = useState(rating ?? 0);
  const [text, setText] = useState(feedback ?? "");
  const [saved, setSaved] = useState(false);
  // Lessons arrive COLLAPSED (the owner, 30/8: "ההקלטות יהיו מכווצות לפי
  // שיעורים עם אופציה לפתוח") — the iframe loads only when a lesson opens,
  // which also stops a 7-lesson course loading 7 Drive players at once.
  const [openVideos, setOpenVideos] = useState<Set<string>>(() => new Set());
  const toggleVideo = (id: string) =>
    setOpenVideos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // The form is open until feedback exists; after sending it folds into a
  // compact thank-you line (with an edit option).
  const [fbOpen, setFbOpen] = useState(rating == null);
  const [, start] = useTransition();

  const unitList = (units ?? []).filter((u) => u.links.length > 0);
  const hasUnits = unitList.length > 0;

  if (!hasUnits && links.length === 0) {
    return (
      <div className="bg-white border border-ink-200 rounded-[16px] p-5 text-sm text-ink-500">
        נשתף איתך את חומרי הקורס אישית בקרוב 💜
      </div>
    );
  }

  function videoBlock(v: ContentLink) {
    const embed = driveEmbedUrl(v.url);
    const isOpen = openVideos.has(v.id);
    return (
      <div key={v.id} className="bg-white border border-ink-200 rounded-[16px] overflow-hidden shadow-sm">
        <div className={cn("flex items-center gap-2 px-4 py-2.5", isOpen && "border-b border-ink-100")}>
          <button
            type="button"
            onClick={() => toggleVideo(v.id)}
            aria-expanded={isOpen}
            className="flex items-center gap-2 flex-1 min-w-0 text-start cursor-pointer"
          >
            <Video size={15} className="text-brand-pink-deep shrink-0" />
            <span className="font-display font-semibold text-sm text-ink-1000 truncate">{v.title}</span>
            <ChevronDown
              size={15}
              className={cn("text-ink-400 transition-transform shrink-0", isOpen && "rotate-180")}
            />
          </button>
          <a
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              start(() =>
                void logContentOpen({
                  ownerType: "course",
                  ownerId: courseId,
                  linkId: v.id,
                  source: "open",
                })
              )
            }
            className="ms-auto inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-brand-purple shrink-0"
          >
            פתחי בדרייב <ExternalLink size={12} />
          </a>
        </div>
        {!isOpen ? null : embed ? (
          <iframe
            src={embed}
            title={v.title}
            allow="autoplay"
            className="w-full aspect-video"
            // Fires on every mount and re-render — the 30-minute throttle in
            // the log is what keeps "כמה פעמים" meaningful.
            onLoad={() =>
              start(() =>
                void logContentOpen({
                  ownerType: "course",
                  ownerId: courseId,
                  linkId: v.id,
                  source: "embed",
                })
              )
            }
          />
        ) : (
          <div className="p-4 text-sm text-ink-500">
            אי אפשר להציג את הסרטון כאן —{" "}
            <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-brand-purple underline">
              צפייה בדרייב
            </a>
          </div>
        )}
      </div>
    );
  }

  function materialsBlock(items: ContentLink[]) {
    if (items.length === 0) return null;
    return (
      <div className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm">
        <div className="font-display font-semibold text-sm text-ink-1000 mb-2">חומרי לימוד</div>
        <div className="flex flex-wrap gap-2">
          {items.map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                start(() =>
                  void logContentOpen({
                    ownerType: "course",
                    ownerId: courseId,
                    linkId: m.id,
                    source: "open",
                  })
                )
              }
              className="inline-flex items-center gap-1.5 text-[13px] bg-tint-purple text-brand-purple border border-[#DDC9EC] rounded-md px-3 py-1.5 hover:bg-tint-indigo"
            >
              <FolderOpen size={14} /> {m.title} <ExternalLink size={12} />
            </a>
          ))}
        </div>
      </div>
    );
  }

  // One gate for the whole course — not one per video. The grant unit in
  // content_shares is the course, so a single press covers every unit,
  // recording and materials folder in it. The משוב card below stays outside
  // it: marking a course as studied has nothing to do with Drive.
  const material = (
    <div className="flex flex-col gap-4">
      {hasUnits
        ? unitList.map((unit) => (
            <section
              key={unit.id}
              className="border border-ink-200 rounded-[20px] bg-ink-50/50 p-4 flex flex-col gap-4"
            >
              <header className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-display font-bold text-[16px] text-ink-1000">{unit.name}</h3>
                {unit.year && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-purple bg-tint-purple border border-[#DDC9EC] rounded-full px-2.5 py-0.5">
                    <CalendarDays size={12} /> {unit.year}
                  </span>
                )}
                <span className="text-[12px] text-ink-500">
                  {unit.links.filter((l) => l.kind === "video").length} שיעורים
                </span>
              </header>
              {unit.links.filter((l) => l.kind === "video").map(videoBlock)}
              {materialsBlock(unit.links.filter((l) => l.kind === "materials"))}
            </section>
          ))
        : (
          <>
            {videos.map(videoBlock)}
            {materialsBlock(materials)}
          </>
        )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <ContentGate
        ownerType="course"
        ownerId={courseId}
        unlocked={unlocked}
        label="פתחי את חומרי הקורס"
      >
        {material}
      </ContentGate>

      {/* Studied + feedback */}
      <div className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            const next = !done;
            setDone(next);
            start(() => void setStudied(courseId, next));
          }}
          className={cn(
            "inline-flex items-center gap-2 self-start text-sm font-semibold px-3.5 py-2 rounded-md border transition-colors",
            done
              ? "bg-tint-mint border-[#A7E3C6] text-[#1B7A4B]"
              : "bg-white border-ink-300 text-ink-700 hover:border-brand-purple"
          )}
        >
          <Check size={15} /> {done ? "סימנת שלמדת את הקורס" : "סמני שלמדת את הקורס"}
        </button>

        {fbOpen ? (
          <div className="flex flex-col gap-2 pt-2 border-t border-ink-100">
            <div className="text-[13px] font-semibold text-ink-700">משוב קצר — עד כמה הקורס תרם לך?</div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setStars(n)} title={`${n}`}>
                  <Star
                    size={22}
                    className={n <= stars ? "text-[#E5A93C]" : "text-ink-300"}
                    fill={n <= stars ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setSaved(false);
              }}
              rows={2}
              placeholder="מה היה שימושי? מה חסר?"
              className="text-[13px] border border-ink-300 rounded-md p-2 outline-none focus:border-brand-purple"
            />
            {!stars && (
              <p className="text-[12px] text-ink-500 -mt-1">
                בחרי דירוג כוכבים (1–5) — ואז אפשר לשלוח את המשוב.
              </p>
            )}
            <button
              type="button"
              disabled={!stars}
              title={!stars ? "קודם בחרי דירוג כוכבים" : undefined}
              onClick={() =>
                start(() => {
                  void saveCourseFeedback(courseId, stars, text);
                  setSaved(true);
                  setFbOpen(false);
                })
              }
              className="self-start text-[13px] font-semibold text-white bg-brand-gradient rounded-md px-4 py-2 disabled:opacity-50"
            >
              שליחת משוב
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-2 border-t border-ink-100 text-[13px] text-ink-700">
            <span className="inline-flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={15}
                  className={n <= stars ? "text-[#E5A93C]" : "text-ink-300"}
                  fill={n <= stars ? "currentColor" : "none"}
                />
              ))}
            </span>
            <span>{saved ? "תודה על המשוב! 💜" : "המשוב שלך נשמר"}</span>
            <button
              type="button"
              onClick={() => setFbOpen(true)}
              className="text-brand-purple font-semibold hover:underline"
            >
              עריכה
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
