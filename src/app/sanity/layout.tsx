import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./sanity.css";

export const metadata: Metadata = {
  title: { absolute: "המסע לאי השפיות" },
  robots: { index: false, follow: false },
};

/*
  המסע לאי השפיות (Hightecourse 2026): the game's own chrome - no community
  shell, no sidebar. Rag Sans (the production's licensed face, streamed from
  /api/sanity/font) with Heebo as the fallback, exactly as the kit's design
  language says. Three screens live under here: the tablet of a circle
  (/sanity/t/<token>), the hall screen (/sanity/hall) and the studio
  (/sanity/studio).
*/
const heebo = Heebo({ subsets: ["hebrew", "latin"], weight: ["300", "400", "500", "700", "900"], variable: "--font-heebo", display: "swap" });

export default function SanityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`hk-root ${heebo.variable}`} dir="rtl" lang="he">
      {children}
    </div>
  );
}
