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

// The `</…>` code motif around a button label. dir="ltr" keeps the bracket
// glyphs from being bidi-scrambled inside RTL text ("</" was rendering as
// "/<"), and the margins keep them from crowding the label.
function bracket(glyph: string, side: "start" | "end") {
  return (
    <span
      aria-hidden
      dir="ltr"
      className={cn("font-mono text-[0.8em] opacity-80", side === "start" ? "me-1.5" : "ms-1.5")}
    >
      {glyph}
    </span>
  );
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
  const classes = cn(buttonVariants({ variant, size }), className);

  // asChild + bracketed: inject the brackets INSIDE the child element (e.g.
  // the <Link>), so the anchor itself gets the button styles and the whole
  // button stays clickable — Slot must receive exactly one element child.
  if (asChild && bracketed && React.isValidElement(children)) {
    const el = children as React.ReactElement<{ children?: React.ReactNode }>;
    return (
      <Comp className={classes} {...props}>
        {React.cloneElement(
          el,
          undefined,
          bracket("</", "start"),
          el.props.children,
          bracket(">", "end")
        )}
      </Comp>
    );
  }

  return (
    <Comp className={classes} {...props}>
      {bracketed ? (
        <>
          {bracket("</", "start")}
          {children}
          {bracket(">", "end")}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { buttonVariants };
