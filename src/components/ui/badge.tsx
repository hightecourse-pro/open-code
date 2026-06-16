import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full text-xs font-semibold",
  {
    variants: {
      variant: {
        grad: "bg-brand-gradient text-white",
        pink: "bg-tint-pink text-brand-pink-deep",
        purple: "bg-tint-purple text-brand-purple",
        indigo: "bg-tint-indigo text-brand-indigo",
        mint: "bg-tint-mint text-success",
        warm: "bg-tint-warm text-crown-gold border border-crown-gold-soft",
        mentor: "bg-[linear-gradient(95deg,#FFD166,#E5A93C)] text-[#5A3D00]",
        tech: "bg-ink-100 text-ink-700 border border-ink-200",
      },
    },
    defaultVariants: { variant: "purple" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Render a small leading status dot in the current text color. */
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  const isTech = variant === "tech";
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-current" />}
      {isTech && (
        <span aria-hidden className="font-mono text-brand-pink -me-0.5">
          {"</"}
        </span>
      )}
      {children}
      {isTech && (
        <span aria-hidden className="font-mono text-brand-pink -ms-0.5">
          {">"}
        </span>
      )}
    </span>
  );
}

export { badgeVariants };
