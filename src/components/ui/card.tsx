import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lift + deepen shadow on hover (for clickable cards). */
  interactive?: boolean;
  /** Selected state — brand border + purple glow. */
  selected?: boolean;
}

/**
 * The standard surface. White bg, subtle lavender border, 20px radius,
 * soft brand-tinted shadow, 24px padding — per the design system Card spec.
 */
export function Card({ className, interactive, selected, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-ink-0 border border-ink-200 rounded-lg shadow-sm p-6",
        "transition-[transform,box-shadow] duration-[220ms] ease-out",
        interactive && "hover:-translate-y-0.5 hover:shadow-lg cursor-pointer",
        selected && "border-[1.5px] border-brand-purple shadow-glow-purple",
        className
      )}
      {...props}
    />
  );
}

export function CardLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "text-[10px] uppercase tracking-[0.06em] font-semibold text-ink-500 mb-1.5",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-display font-bold text-[17px] text-ink-1000 mt-3 mb-1.5",
        className
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-ink-700 leading-relaxed", className)} {...props} />;
}
