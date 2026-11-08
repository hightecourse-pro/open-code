// The second design of the projects portal (the owner, 4/11): her Claude Design canvas, rebuilt here
// as a route of its own beside /hackathon-2026/projects so the two can be compared. Since 8/11 (the
// product manager's notes): the three partners' cards and the figures on top (tinted, beside the jumping
// logo, no words), the three winners with their pictures, the small tiles of every other project in the
// challenges' order with the filter line stuck under the top bar, then the sentences, the employers'
// call, the footer. No ״איך זה עבד״.
// PUBLIC, not indexed while it is a comparison.
import type { Metadata } from "next";
import { Suspense } from "react";
import { COUNTS, PROJECTS, projectByK8, topTech } from "@/lib/hackathon-showcase";
import { Explorer } from "./explorer";
import { PartnerCards, Partners } from "./partners";
import type { QuoteItem } from "./quotes";
import { Dashboard, Employers, Footer, Quotes, TopBar, WRAP, Winners } from "./ui";

const DESCRIPTION = `${COUNTS.projects} מערכות AI עובדות שבנו ${COUNTS.people} מפתחות מקהילת קוד פתוח בשבוע, לשלושה ארגונים אמיתיים: שטראוס, הפניקס והמעבדה המרכזית לנגיפים. לכל פרויקט - הסרטון, המוצר בענן, הטכנולוגיות ומשפט אישי.`;

export const metadata: Metadata = {
  title: "הפרויקטים של האקתון AI 2026",
  description: DESCRIPTION,
  robots: { index: false, follow: true },
  openGraph: { title: "הפרויקטים של האקתון AI קוד פתוח 2026", description: DESCRIPTION, images: [{ url: "/hackathon-2026/logo-hackathon.png" }] },
};

/**
 * The sentences that move in the carousel between the partners and the employers (the owner, 5/11: ״תוסיף עוד
 * כמה משמעותיים שיזוזו בקרוסלה״) - picked by project and name, the words come verbatim from the data.
 */
const QUOTE_PICKS: [string, string][] = [
  ["1da3dbcf", "יפה חבקין"],
  ["fe373ef4", "רחל הרשנבוים"],
  ["86955892", "יעל יוליארד"],
  ["718fcb78", "הודיה פרידלנד"],
  ["12edfc42", "יהודית קראוס"],
  ["80213887", "חנה קוסובסקי"],
  ["e632e7e3", "רחל פויכטונגר"],
  ["b04e60f4", "שני וועג"],
  ["4fd451bd", "שרה ברייש"],
];
const QUOTES: QuoteItem[] = QUOTE_PICKS.flatMap(([k8, name]) => {
  const p = projectByK8(k8);
  const q = p?.quotes.find((x) => x.name === name);
  return p && q ? [{ k8, challenge: p.challenge, name: q.name, quote: q.quote }] : [];
});

export default function ShowcasePage() {
  return (
    <main className="min-h-full bg-white text-[#1B1530] overflow-x-hidden">
      <TopBar />
      <Dashboard
        partners={
          <Suspense fallback={<PartnerCards />}>
            <Partners />
          </Suspense>
        }
      />
      <Winners />
      <Suspense fallback={<div className={`${WRAP} py-16 text-center text-[#6B6580]`}>טוענת את הפרויקטים…</div>}>
        <Explorer projects={PROJECTS} topTech={topTech(14)} />
      </Suspense>
      <Quotes items={QUOTES} />
      <Employers />
      <Footer />
    </main>
  );
}
