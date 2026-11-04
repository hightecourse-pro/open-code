// The second design of the projects portal is set in Heebo (the owner's Claude Design canvas, 4/11);
// the rest of the site stays in Noto Sans Hebrew. The font is served from public/fonts (the variable
// woff2 of the hebrew + latin subsets, OFL) - not through next/font/google: that fetch at build time
// broke the Vercel build on 4.11 when Google started serving extra ״math״ / ״symbols״ subsets
// (״next/font/google queries have exactly one entry״), and the owner's network may block Google Fonts
// at runtime anyway.
import type { ReactNode } from "react";

const FACES = `
@font-face { font-family: 'Heebo'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(/fonts/heebo-hebrew.woff2) format('woff2'); unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F; }
@font-face { font-family: 'Heebo'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(/fonts/heebo-latin.woff2) format('woff2'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
`;

export default function ShowcaseLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full" style={{ fontFamily: "'Heebo', system-ui, sans-serif" }} data-testid="sh-root">
      <style>{FACES}</style>
      {children}
    </div>
  );
}
