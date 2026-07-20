import Link from "next/link";
import { Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The friendly nudge a free member sees wherever a paid feature would be.
 * Never scolding — it names what's waiting for her and offers the way in.
 */
export function UpgradeCard({
  title,
  body,
  cta = "להצטרפות למנוי",
  className,
}: {
  title: string;
  body: string;
  cta?: string;
  className?: string;
}) {
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
export function UpgradeNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 bg-tint-purple border border-[#DDC9EC] rounded-md p-3 px-4 text-[13.5px] text-ink-700",
        className
      )}
    >
      <Lock size={16} className="text-brand-purple shrink-0 mt-0.5" />
      <span className="flex-1">{children}</span>
      <Link href="/join" className="text-brand-purple font-semibold whitespace-nowrap hover:underline">
        לשדרוג ←
      </Link>
    </div>
  );
}
