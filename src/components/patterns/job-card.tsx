"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
  sent: { label: "המועמדות שלך הוגשה למעסיק 🤞", cls: "text-brand-indigo" },
  interview: { label: "זומנת לראיון! 🎯", cls: "text-success" },
  exam: { label: "עברת שלב — יש מבחן בדרך ✍️", cls: "text-brand-indigo" },
  hired: { label: "גויסת! 🎉", cls: "text-success" },
  declined: { label: "הפעם זה לא התקדם — ממשיכות הלאה 💪", cls: "text-ink-500" },
  waitlisted: { label: "התקדמנו בינתיים עם מועמדות אחרות 💜", cls: "text-ink-500" },
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
  /** The job's tags she actually shares — named on the badge, never just counted. */
  matchedTags?: string[];
  /** Free members may apply, but the board says subscribers come first. */
  subscriber?: boolean;
}

export function JobCard({
  job,
  saved,
  applied,
  applicationStatus = null,
  myTech = [],
  matchedTags = [],
  subscriber = true,
}: JobCardProps) {
  const [isSaved, setSaved] = useState(saved);
  const [hasApplied, setApplied] = useState(applied);
  const [applyError, setApplyError] = useState<string | null>(null);
  // The description is clamped on the card; "עוד" opens it in place, because a
  // market job has no other screen where the full text exists.
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [, start] = useTransition();
  const logo = LOGO_GRADIENTS[(job.logo_variant - 1) % LOGO_GRADIENTS.length];
  const techSet = new Set(myTech);

  // Show the affordance only when text is really cut off — measured once per
  // mount and on resize (the clamp depends on the column width).
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
    // Re-measured when she expands: collapsing back must restore the button.
  }, [expanded]);

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
    <article className="bg-white border border-ink-200 rounded-[18px] p-5 flex flex-col transition-[transform,box-shadow] duration-[220ms] hover:-translate-y-0.5 hover:shadow-md hover:border-brand-pink">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant={job.source === "ours" ? "pink" : "tech"}>
          {job.source === "ours" ? "משרה שלנו" : "משרה פתוחה"}
        </Badge>
        {matchedTags.length > 0 && (
          <Badge variant="mint" title={`הטכנולוגיות המשותפות: ${matchedTags.join(", ")}`}>
            <Sparkles size={11} className="inline me-1" />
            מתאימה לפרופיל שלך ·{" "}
            {matchedTags.length === 1
              ? "טכנולוגיה משותפת אחת"
              : `${matchedTags.length} טכנולוגיות משותפות`}
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
          {job.source === "ours" ? "ק" : job.company.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          {/* The client behind an internal job is confidential — members see
              only the role and its requirements. */}
          <div className="text-[12.5px] text-ink-500">
            {job.source === "ours" ? "משרה בלעדית · קוד פתוח" : job.company}
          </div>
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

      {(job.description_html || job.description) && (
        <div className="mb-3">
          {job.description_html ? (
            // The admin's styled requirements (sanitized at save by the
            // allowlist in lib/rich-text) — shown as she composed them.
            <div
              ref={bodyRef}
              dir="rtl"
              className={[
                "text-[13.5px] text-ink-700 leading-relaxed",
                expanded ? "" : "line-clamp-4",
                "[&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5",
                "[&_h3]:font-display [&_h3]:font-bold [&_h3]:text-[14px] [&_h3]:text-brand-purple",
                "[&_a]:text-brand-purple [&_a]:underline [&_p]:my-1 [&_b]:text-ink-1000 [&_strong]:text-ink-1000",
              ].join(" ")}
              dangerouslySetInnerHTML={{ __html: job.description_html }}
            />
          ) : (
            <div
              ref={bodyRef}
              className={cn(
                "text-[13.5px] text-ink-700 leading-relaxed whitespace-pre-line",
                !expanded && "line-clamp-4"
              )}
            >
              {job.description}
            </div>
          )}
          {(clamped || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-1 font-semibold text-[12.5px] text-brand-purple hover:text-brand-pink-deep cursor-pointer"
            >
              {expanded ? "פחות" : "עוד ←"}
            </button>
          )}
        </div>
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

      {applyError && (
        <div className="text-[12.5px] text-danger bg-danger-bg border border-[#F5C6C0] rounded-md px-2.5 py-1.5 mb-3">
          {applyError}
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
        ) : job.source === "ours" ? (
          // Our jobs go through the application wizard (questions + CV choice).
          <Link
            href={`/jobs/${job.id}/apply`}
            className="ms-auto inline-flex items-center gap-1.5 font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-brand-gradient text-white"
          >
            הגשת מועמדות
          </Link>
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
