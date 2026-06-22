"use client";

import { useState, useTransition } from "react";
import { Video, FolderOpen, ExternalLink, Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { driveEmbedUrl } from "@/lib/drive";
import { recordView, setStudied, saveCourseFeedback } from "@/app/(app)/courses/actions";
import type { ContentLink } from "@/types/database";

export interface CourseContentProps {
  courseId: string;
  links: ContentLink[];
  studied: boolean;
  rating: number | null;
  feedback: string | null;
}

export function CourseContent({ courseId, links, studied, rating, feedback }: CourseContentProps) {
  const videos = links.filter((l) => l.kind === "video");
  const materials = links.filter((l) => l.kind === "materials");

  const [done, setDone] = useState(studied);
  const [stars, setStars] = useState(rating ?? 0);
  const [text, setText] = useState(feedback ?? "");
  const [saved, setSaved] = useState(false);
  const [, start] = useTransition();

  if (links.length === 0) {
    return (
      <div className="bg-white border border-ink-200 rounded-[16px] p-5 text-sm text-ink-500">
        החומרים של הקורס ישותפו אלייך אישית בקרוב 💜
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Videos — embedded, view-only */}
      {videos.length > 0 && (
        <div className="flex flex-col gap-4">
          {videos.map((v) => {
            const embed = driveEmbedUrl(v.url);
            return (
              <div key={v.id} className="bg-white border border-ink-200 rounded-[16px] overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-100">
                  <Video size={15} className="text-brand-pink-deep" />
                  <span className="font-display font-semibold text-sm text-ink-1000">{v.title}</span>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => start(() => void recordView(v.id))}
                    className="ms-auto inline-flex items-center gap-1 text-[12px] text-ink-500 hover:text-brand-purple"
                  >
                    פתחי בדרייב <ExternalLink size={12} />
                  </a>
                </div>
                {embed ? (
                  <iframe
                    src={embed}
                    title={v.title}
                    allow="autoplay"
                    className="w-full aspect-video"
                    onLoad={() => start(() => void recordView(v.id))}
                  />
                ) : (
                  <div className="p-4 text-sm text-ink-500">
                    לא ניתן להטמיע את הסרטון —{" "}
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className="text-brand-purple underline">
                      צפייה בדרייב
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Materials — folders open out */}
      {materials.length > 0 && (
        <div className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm">
          <div className="font-display font-semibold text-sm text-ink-1000 mb-2">חומרי לימוד</div>
          <div className="flex flex-wrap gap-2">
            {materials.map((m) => (
              <a
                key={m.id}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] bg-tint-purple text-brand-purple border border-[#DDC9EC] rounded-md px-3 py-1.5 hover:bg-tint-indigo"
              >
                <FolderOpen size={14} /> {m.title} <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </div>
      )}

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
          <button
            type="button"
            disabled={!stars}
            onClick={() =>
              start(() => {
                void saveCourseFeedback(courseId, stars, text);
                setSaved(true);
              })
            }
            className="self-start text-[13px] font-semibold text-white bg-brand-gradient rounded-md px-4 py-2 disabled:opacity-50"
          >
            {saved ? "תודה! נשמר ✓" : "שליחת משוב"}
          </button>
        </div>
      </div>
    </div>
  );
}
