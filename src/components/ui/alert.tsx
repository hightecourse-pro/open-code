import * as React from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertVariant = "success" | "info" | "warn" | "danger";

const styles: Record<
  AlertVariant,
  { wrap: string; icon: string; Icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  success: {
    wrap: "bg-tint-mint border-[#BFE4D1] text-[#0F6E4A]",
    icon: "bg-success",
    Icon: Check,
  },
  info: {
    wrap: "bg-tint-purple border-[#DDC9EC] text-brand-purple",
    icon: "bg-brand-purple",
    Icon: Info,
  },
  warn: {
    wrap: "bg-tint-warm border-[#F8D98C] text-[#8C5E0E]",
    icon: "bg-warning",
    Icon: TriangleAlert,
  },
  danger: {
    wrap: "bg-danger-bg border-[#F2BBC8] text-[#A8254B]",
    icon: "bg-danger",
    Icon: X,
  },
};

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  /** Bold lead line (rendered in display font, ink-1000). */
  title?: React.ReactNode;
}

export function Alert({ className, variant = "info", title, children, ...props }: AlertProps) {
  const s = styles[variant];
  return (
    <div
      className={cn("flex gap-3 p-4 rounded-md border items-start", s.wrap, className)}
      role={variant === "danger" ? "alert" : "status"}
      {...props}
    >
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0",
          s.icon
        )}
      >
        <s.Icon size={14} />
      </div>
      <div className="text-sm leading-snug">
        {title && (
          <b className="font-display font-bold block mb-0.5 text-ink-1000">{title}</b>
        )}
        {children}
      </div>
    </div>
  );
}
