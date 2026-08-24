"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark, Check, ExternalLink, MapPin, Briefcase, Sparkles, Crown, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn, timeAgo } from "@/lib/utils";
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
  sent: { label: "המועמדות שלך הוגשה למעסיק 🤞", cls: "text-brand-indigo" },
  interview: { label: "זומנת לראיון! 🎯", cls: "text-success" },
  exam: { label: "עברת שלב — יש מבחן בדרך ✍️", cls: "text-brand-indigo" },
  hired: { label: "גויסת! 🎉", cls: "text-success" },
  declined: { label: "הפעם זה לא התקדם — ממשיכות הלאה 💪", cls: "text-ink-500" },
  waitlisted: { label: "התקדמנו בינתיים עם מועמדות אחרות 💜", cls: "text-ink-500" },
};

// The scannable version of the status — a small pill at the top of the card,
// so an applied job is unmistakable without reading the footer.
const APP_STATUS_SHORT: Record<ApplicationStatus, string> = {
  draft: "טיוטה",
  submitted: "הוגשה לקוד פתוח ✓",
  in_review: "בבדיקה 👀",
  accepted: "התקבלת 🎉",
  rejected: "לא התקדם",
  sent: "אצל המעסיק 🤞",
  interview: "ראיון 🎯",
  exam: "מבחן ✍️",
  hired: "גויסת 🎉",
  declined: "לא התקדם",
  waitlisted: "בהמתנה",
};

const LOGO_GRADIENTS = [
  "bg-[linear-gradient(135deg,#E0418D,#913F80)]",
  "bg-[linear-gradient(135deg,#6B3D99,#464CA0)]",
  "bg-[linear-gradient(135deg,#1F1E3F,#464CA0)]",
  "bg-[linear-gradient(135deg,#913F80,#E0418D)]",
];

export interface JobCardProps {
  job: Job;
  saved: boolean;
  applied: boolean;
  /** The member's application status for this job (null if she hasn't applied). */
  applicationStatus?: ApplicationStatus | null;
  /** When she applied — the PM asked for the date to be visible. */
  appliedAt?: string | null;
  /** Member's tech stack, lowercase, for match highlighting. */
  myTech?: string[];
  /** The job's tags she actually shares — named on the badge, never just counted. */
  matchedTags?: string[];
  /** Free members may apply, but the board says subscribers come first. */
  subscriber?: boolean;
}

const APPLIED_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  timeZone: "Asia/Jerusalem",
});

/**
 * One job on the board. Compact by design (the PM's feedback): a fixed
 * three-line description with an ellipsis keeps every card the same height in
 * the grid; the full text lives one click away on the apply screen (ours) or
 * expands in place (market jobs, which have no other screen).
 */
export function JobCard({
  job,
  saved,
  applied,
  applicationStatus = null,
  appliedAt = null,
  myTech = [],
  matchedTags = [],
  subscriber = true,
}: JobCardProps) {
  const [isSaved, setSaved] = useState(saved);
  const [hasApplied, setApplied] = useState(applied);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [, start] = useTransition();
  const logo = LOGO_GRADIENTS[(job.logo_variant - 1) % LOGO_GRADIENTS.length];
  const techSet = new Set(myTech);
  const publishedAt = job.published_at ?? job.created_at;

  function onSave() {
    const next = !isSaved;
    setSaved(next);
    start(() => void toggleSaveJob(job.id, next));
  }

  function onApply() {
    setApplied(true);
    start(async () => {
      const res = await applyToJob(job.id);
      // Don't leave her believing she applied when she didn't.
      if (res?.error) {
        setApplied(false);
        setApplyError(res.error);
      }
    });
  }

  return (
    <article className="bg-white border border-ink-200 rounded-[16px] p-4 flex flex-col h-full transition-[transform,box-shadow] duration-[220ms] hover:-translate-y-0.5 hover:shadow-md hover:border-brand-pink">
      <div className="flex gap-2.5 items-start">
        <div
          className={cn(
            "w-[42px] h-[42px] rounded-[11px] shrink-0 flex items-center justify-center text-white font-display font-black text-lg",
            logo
          )}
        >
          {job.source === "ours" ? "ק" : job.company.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          {/* Market jobs name their company; ours say nothing — the ק logo and
              the tab already said it (PM: the repeated "בלעדית" was noise).
              The client behind an internal job stays confidential either way. */}
          {(job.source !== "ours" || hasApplied) && (
            <div className="text-[11.5px] text-ink-500 flex items-center gap-1.5">
              {job.source !== "ours" && <span className="truncate">{job.company}</span>}
              {hasApplied && (
                <span className="inline-flex items-center shrink-0 rounded-full bg-tint-mint text-success px-2 py-px text-[10.5px] font-bold">
                  {applicationStatus ? APP_STATUS_SHORT[applicationStatus] : "הוגשה לקוד פתוח ✓"}
                </span>
              )}
            </div>
          )}
          <div className="font-display text-[16px] font-bold text-ink-1000 leading-snug truncate">
            {job.title}
          </div>
        </div>
        <button
          type="button"
          onClick={onSave}
          aria-label={isSaved ? "הסרת שמירה" : "שמירה"}
          className={cn(
            "w-[28px] h-[28px] rounded-full flex items-center justify-center shrink-0 border transition-colors",
            isSaved
              ? "bg-brand-gradient border-transparent text-white"
              : "bg-ink-50 border-ink-200 text-ink-500 hover:text-brand-pink-deep"
          )}
        >
          <Bookmark size={12} fill={isSaved ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="flex gap-2.5 text-[11.5px] text-ink-500 flex-wrap mt-1.5">
        {job.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} /> {job.location}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Briefcase size={11} /> {EMPLOYMENT[job.employment_type]}
        </span>
        {/* Automatic — from the moment it went live. */}
        <span className="inline-flex items-center gap-1" suppressHydrationWarning>
          <CalendarDays size={11} /> פורסמה {timeAgo(publishedAt)}
        </span>
      </div>

      {/* WHY it fits her, by name — personalization she can verify. */}
      {matchedTags.length > 0 && (
        <div className="inline-flex items-center gap-1 text-[12px] font-semibold text-success mt-1.5">
          <Sparkles size={12} className="shrink-0" />
          <span className="truncate">
            מתאימה לך · {matchedTags.slice(0, 3).join(" · ")}
            {matchedTags.length > 3 ? ` +${matchedTags.length - 3}` : ""}
          </span>
        </div>
      )}

      {(job.description_html || job.description) && (
        <div className="mt-2">
          {job.description_html ? (
            <div
              dir="rtl"
              className={[
                "text-[13px] text-ink-700 leading-relaxed",
                expanded ? "" : "line-clamp-3",
                "[&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5",
                "[&_h3]:font-display [&_h3]:font-bold [&_h3]:text-[13.5px] [&_h3]:text-brand-purple",
                "[&_a]:text-brand-purple [&_a]:underline [&_p]:my-0.5 [&_b]:text-ink-1000 [&_strong]:text-ink-1000",
              ].join(" ")}
              dangerouslySetInnerHTML={{ __html: job.description_html }}
            />
          ) : (
            <div
              className={cn(
                "text-[13px] text-ink-700 leading-relaxed whitespace-pre-line",
                !expanded && "line-clamp-3"
              )}
            >
              {job.description}
            </div>
          )}
          {job.source === "open" && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-0.5 font-semibold text-[12px] text-brand-purple hover:text-brand-pink-deep cursor-pointer"
            >
              {expanded ? "פחות" : "עוד ←"}
            </button>
          )}
        </div>
      )}

      {job.tech_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {job.tech_tags.slice(0, 6).map((tag) => (
            <Badge key={tag} variant={techSet.has(tag.trim().toLowerCase()) ? "mint" : "tech"}>
              {tag}
            </Badge>
          ))}
          {job.tech_tags.length > 6 && (
            <span className="text-[11px] text-ink-400 self-center">+{job.tech_tags.length - 6}</span>
          )}
        </div>
      )}

      {applyError && (
        <div className="text-[12.5px] text-danger bg-danger-bg border border-[#F5C6C0] rounded-md px-2.5 py-1.5 mt-2">
          {applyError}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2.5 border-t border-ink-100 mt-auto">
        {!subscriber && job.source === "ours" && !hasApplied && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#8C5E0E]">
            <Crown size={11} /> עדיפות למנויות
          </span>
        )}
        {hasApplied ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[12.5px] font-semibold",
              applicationStatus ? APP_STATUS[applicationStatus].cls : "text-success"
            )}
          >
            <Check size={13} />
            {applicationStatus ? APP_STATUS[applicationStatus].label : "הגשת"}
            {appliedAt && (
              <span className="font-normal text-ink-400" suppressHydrationWarning>
                · {APPLIED_DATE.format(new Date(appliedAt))}
              </span>
            )}
          </span>
        ) : job.source === "ours" ? (
          // Our jobs go through the application wizard (questions + CV choice).
          <Link
            href={`/jobs/${job.id}/apply`}
            className="ms-auto inline-flex items-center gap-1.5 font-display font-semibold text-[12.5px] px-3.5 py-1.5 rounded-md bg-brand-gradient text-white"
          >
            הגשת מועמדות
          </Link>
        ) : job.source === "open" && job.external_url ? (
          <a
            href={job.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-auto inline-flex items-center gap-1.5 font-display font-semibold text-[12.5px] px-3.5 py-1.5 rounded-md bg-white text-brand-purple border-[1.5px] border-brand-purple"
          >
            להגשה <ExternalLink size={12} />
          </a>
        ) : (
          <button
            type="button"
            onClick={onApply}
            className="ms-auto inline-flex items-center gap-1.5 font-display font-semibold text-[12.5px] px-3.5 py-1.5 rounded-md bg-brand-gradient text-white"
          >
            הגשת מועמדות
          </button>
        )}
      </div>
    </article>
  );
}
