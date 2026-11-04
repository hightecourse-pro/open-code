// The second design of the projects portal is set in Heebo (the owner's Claude Design canvas, 4/11);
// the rest of the site stays in Noto Sans Hebrew. The font is loaded once for this route segment.
import { Heebo } from "next/font/google";
import type { ReactNode } from "react";

const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["400", "500", "700", "800", "900"], variable: "--font-heebo", display: "swap" });

export default function ShowcaseLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${heebo.variable} min-h-full`} style={{ fontFamily: "var(--font-heebo), system-ui, sans-serif" }} data-testid="sh-root">
      {children}
    </div>
  );
}
