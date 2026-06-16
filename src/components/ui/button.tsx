import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-display font-semibold cursor-pointer select-none " +
    "transition-[transform,box-shadow,filter] duration-[220ms] ease-spring " +
    "hover:-translate-y-px active:translate-y-0 active:scale-[0.98] " +
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100",
  {
    variants: {
      variant: {
        primary: "bg-brand-gradient text-white shadow-glow-pink hover:brightness-105",
        secondary:
          "bg-white text-brand-purple border-[1.5px] border-brand-purple hover:bg-tint-purple",
        ghost: "text-ink-700 hover:bg-ink-100",
        pill: "bg-ink-900 text-white",
      },
      size: {
        md: "text-[15px] rounded-md px-[22px] py-3",
        sm: "text-[13px] rounded-sm px-[14px] py-2",
      },
    },
    compoundVariants: [
      // The pill is fully rounded regardless of size.
      { variant: "pill", size: "md", class: "rounded-full text-sm px-5 py-2.5" },
      { variant: "pill", size: "sm", class: "rounded-full" },
    ],
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as a child element (e.g. an <a>) while keeping button styles. */
  asChild?: boolean;
  /** Wrap the label in the </…> code-bracket motif (matches button text color). */
  bracketed?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  bracketed = false,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {bracketed ? (
        <span className="inline-flex items-center">
          <span aria-hidden className="font-mono text-[0.85em] opacity-70">
            {"</"}
          </span>
          {children}
          <span aria-hidden className="font-mono text-[0.85em] opacity-70">
            {">"}
          </span>
        </span>
      ) : (
        children
      )}
    </Comp>
  );
}

export { buttonVariants };
