import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "rounded-full inline-flex items-center justify-center text-white font-display font-bold shrink-0 relative",
  {
    variants: {
      size: {
        xs: "w-8 h-8 text-[13px]",
        sm: "w-9 h-9 text-[13px]",
        md: "w-11 h-11 text-base",
        lg: "w-14 h-14 text-xl",
        xl: "w-[72px] h-[72px] text-[26px]",
      },
      tone: {
        pink: "bg-[linear-gradient(135deg,#E0418D,#913F80)]",
        purple: "bg-[linear-gradient(135deg,#913F80,#464CA0)]",
        gold: "bg-[linear-gradient(135deg,#FFD166,#E5A93C)] text-[#5A3D00]",
      },
    },
    defaultVariants: { size: "md", tone: "pink" },
  }
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  /** Hebrew initial(s) to display. */
  initials: string;
  /** Show the mentor crown 👑. */
  crown?: boolean;
}

export function Avatar({ className, size, tone, initials, crown, ...props }: AvatarProps) {
  return (
    <div className={cn(avatarVariants({ size, tone }), className)} {...props}>
      {initials}
      {crown && (
        <span
          aria-hidden
          className="absolute -top-2 -right-1 text-lg rotate-[20deg] leading-none"
        >
          👑
        </span>
      )}
    </div>
  );
}

export interface AvatarStackProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Extra count shown as a "+N" chip at the end. */
  extra?: number;
}

/** Overlapping row of avatars. Children should be <Avatar size="sm" />. */
export function AvatarStack({ className, extra, children, ...props }: AvatarStackProps) {
  return (
    <div className={cn("flex", className)} {...props}>
      <div className="flex [&>*]:-ml-2.5 [&>*]:border-[2.5px] [&>*]:border-white">
        {children}
        {extra != null && extra > 0 && (
          <div className="rounded-full inline-flex items-center justify-center shrink-0 w-9 h-9 text-xs bg-ink-100 text-ink-700 font-display font-bold">
            +{extra}
          </div>
        )}
      </div>
    </div>
  );
}
