import Image from "next/image";
import { cn } from "@/lib/utils";

// Intrinsic dimensions of public/logo-opencode.png (the full lockup with tagline).
const RATIO = 2481 / 3509;

export interface LogoProps {
  /** Rendered width in px (height is derived from the logo's aspect ratio). */
  width?: number;
  className?: string;
  /** Set on above-the-fold logos (e.g. marketing hero) to preload. */
  priority?: boolean;
}

/** The official Open Code (קוד פתוח) lockup. Use on light surfaces. */
export function Logo({ width = 150, className, priority }: LogoProps) {
  return (
    <Image
      src="/logo-opencode.png"
      alt="קוד פתוח"
      width={width}
      height={Math.round(width * RATIO)}
      priority={priority}
      className={cn("h-auto w-auto", className)}
      style={{ width }}
    />
  );
}
