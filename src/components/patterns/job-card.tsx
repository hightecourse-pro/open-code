"use client";

import { useState, useTransition } from "react";
import { Bookmark, Check, ExternalLink, MapPin, Briefcase, Sparkles, Crown } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { applyToJob, toggleSaveJob } from "@/app/(app)/jobs/actions";
import type { ApplicationStatus, EmploymentType, Job } from "@/types/database";

const EMPLOYMENT: Record<EmploymentType, string> = {
  full: "משרה מלאה",
  part: "חלקית",
  student: "סטודנטית",
  freelance: "פרילנס",
};

// What the member sees about her own application, per pipeline status.
const APP_STATUS: Record<ApplicationStatus, { label: string; cls: string }> = {
  draft: { label: "טיוטה", cls: "text-ink-500" },
  submitted: { label: "הגשת — נעדכן אותך 💜", cls: "text-success" },
  in_review: { label: "המועמדות שלך בבדיקה 👀", cls: "text-brand-indigo" },
  accepted: { label: "התקבלת! 🎉", cls: "text-success" },
  rejected: { label: "הפעם זה לא התקדם — ממשיכות הלאה 💪", cls: "text-ink-500" },
};

const LOGO_GRADIENTS = [
  "bg-[linear-gradient(135deg,#E0418D,#913F80)]",
  "bg-[linear-gradient(135deg,#6B3D99,#464CA0)]",
  "bg-[linear-gradient(135deg,#1F1E3F,#464CA0)]",
  "bg-[linear-gradient(135deg,#36C57B,#28A864)]",
];

export interface JobCardProps {
  job: Job;
  saved: boolean;
  applied: boolean;
  /** The member's application status for this job (null if she hasn't applied). */
  applicationStatus?: ApplicationStatus | null;
  /** Member's tech stack, lowercase, for match highlighting. */
  myTech?: string[];
  /** Number of job tags matching the member's profile. */
  matches?: number;
  /** Free members may apply, but the board says subscribers come first. */
  subscriber?: boolean;
}

export function JobCard({
  job,
  saved,
  applied,
  applicationStatus = null,
  myTech = [],
  matches = 0,
  subscriber = true,
}: JobCardProps) {
  const [isSaved, setSaved] = useState(saved);
  const [hasApplied, setApplied] = useState(applied);
  const [, start] = useTransition();
  const logo = LOGO_GRADIENTS[(job.logo_variant - 1) % LOGO_GRADIENTS.length];
  const techSet = new Set(myTech);

  function onSave() {
    const next = !isSaved;
    setSaved(next);
    start(() => void toggleSaveJob(job.id, next));
  }

  function onApply() {
    setApplied(true);
    start(() => void applyToJob(job.id));
  }

  return (
    <article className="bg-white border border-ink-200 rounded-[18px] p-5 flex flex-col transition-[transform,box-shadow] duration-[220ms] hover:-translate-y-0.5 hover:shadow-md hover:border-brand-pink">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant={job.source === "ours" ? "pink" : "tech"}>
          {job.source === "ours" ? "משרה שלנו" : "משרה פתוחה"}
        </Badge>
        {matches > 0 && (
          <Badge variant="mint">
            <Sparkles size={11} className="inline me-1" />
            מתאימה לפרופיל שלך
          </Badge>
        )}
      </div>

      <div className="flex gap-3 items-start mb-3">
        <div
          className={cn(
            "w-[52px] h-[52px] rounded-[13px] shrink-0 flex items-center justify-center text-white font-display font-black text-xl",
            logo
          )}
        >
          {job.company.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] text-ink-500">{job.company}</div>
          <div className="font-display text-[17px] font-bold text-ink-1000">{job.title}</div>
          <div className="flex gap-3 text-xs text-ink-500 flex-wrap mt-1.5">
            {job.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {job.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Briefcase size={12} /> {EMPLOYMENT[job.employment_type]}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onSave}
          aria-label={isSaved ? "הסרת שמירה" : "שמירה"}
          className={cn(
            "w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 border transition-colors",
            isSaved
              ? "bg-brand-gradient border-transparent text-white"
              : "bg-ink-50 border-ink-200 text-ink-500 hover:text-brand-pink-deep"
          )}
        >
          <Bookmark size={13} fill={isSaved ? "currentColor" : "none"} />
        </button>
      </div>

      {job.description && (
        <p className="text-[13.5px] text-ink-700 leading-relaxed mb-3 line-clamp-3">
          {job.description}
        </p>
      )}

      {job.tech_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {job.tech_tags.map((tag) => (
            <Badge key={tag} variant={techSet.has(tag.trim().toLowerCase()) ? "mint" : "tech"}>
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {!subscriber && job.source === "ours" && (
        <div className="flex items-center gap-1.5 text-[12px] text-[#8C5E0E] bg-tint-warm border border-[#F0DCA8] rounded-md px-2.5 py-1.5 mb-3">
          <Crown size={12} className="shrink-0" />
          עדיפות למנויות הקהילה
        </div>
      )}

      <div className="flex items-center gap-2.5 pt-3 border-t border-ink-100 mt-auto">
        {hasApplied ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[13px] font-semibold",
              applicationStatus ? APP_STATUS[applicationStatus].cls : "text-success"
            )}
          >
            <Check size={14} /> {applicationStatus ? APP_STATUS[applicationStatus].label : "הגשת"}
          </span>
        ) : job.source === "open" && job.external_url ? (
          <a
            href={job.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-auto inline-flex items-center gap-1.5 font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-white text-brand-purple border-[1.5px] border-brand-purple"
          >
            להגשה <ExternalLink size={13} />
          </a>
        ) : (
          <button
            type="button"
            onClick={onApply}
            className="ms-auto inline-flex items-center gap-1.5 font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-brand-gradient text-white"
          >
            הגשת מועמדות
          </button>
        )}
      </div>
    </article>
  );
}
