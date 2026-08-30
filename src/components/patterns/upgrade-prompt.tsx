import Link from "next/link";
import { Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The friendly nudge a free member sees wherever a paid feature would be.
 * Never scolding — it names what's waiting for her and offers the way in.
 *
 * mentorWaiting: a mentor-track account that isn't active yet (pending
 * approval / paused) must NEVER be pitched a payment — mentors don't pay.
 * The card explains the approval instead (the owner, 2026-08-30: "זה נראה
 * בלגן שלם... מצד שני מציע לי לשלם").
 */
export function UpgradeCard({
  title,
  body,
  cta = "להצטרפות למנוי",
  className,
  mentorWaiting = false,
}: {
  title: string;
  body: string;
  cta?: string;
  className?: string;
  mentorWaiting?: boolean;
}) {
  if (mentorWaiting) {
    title = "החשבון שלך כמנטורית עוד לא פעיל 👑";
    body =
      "מנטוריות לא משלמות — הצוות עובר על הבקשה שלך, וברגע שתאושרי הכול נפתח מעצמו. אפשר לראות את המצב בכל רגע.";
    cta = "למצב הבקשה שלי";
  }
  return (
    <div
      className={cn(
        "bg-white border border-[#DDC9EC] rounded-[18px] p-6 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center",
        className
      )}
    >
      <span className="w-11 h-11 rounded-full bg-brand-gradient-soft flex items-center justify-center shrink-0 text-brand-pink-deep">
        <Sparkles size={20} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-ink-1000 text-[15.5px]">{title}</div>
        <p className="t-body-sm text-ink-700 mt-0.5">{body}</p>
      </div>
      <Link
        href="/join"
        className="shrink-0 inline-flex items-center justify-center font-display font-semibold text-[13.5px] px-[18px] py-2.5 rounded-md bg-brand-gradient text-white shadow-glow-pink"
      >
        {cta}
      </Link>
    </div>
  );
}

/** A slim inline version for sitting under a heading or beside a list. */
export function UpgradeNote({
  children,
  className,
  mentorWaiting = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** A not-yet-active mentor is told about approval, never about paying. */
  mentorWaiting?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 bg-tint-purple border border-[#DDC9EC] rounded-md p-3 px-4 text-[13.5px] text-ink-700",
        className
      )}
    >
      <Lock size={16} className="text-brand-purple shrink-0 mt-0.5" />
      <span className="flex-1">
        {mentorWaiting
          ? "החלק הזה ייפתח ברגע שהצוות יאשר את הבקשה שלך כמנטורית — בלי תשלום 💜"
          : children}
      </span>
      <Link href="/join" className="text-brand-purple font-semibold whitespace-nowrap hover:underline">
        {mentorWaiting ? "למצב הבקשה ←" : "לשדרוג ←"}
      </Link>
    </div>
  );
}
