// The second design of the projects portal (the owner, 4/11): her Claude Design canvas, rebuilt here
// as a route of its own beside /hackathon-2026/projects so the two can be compared. Since 5/11 the
// order answers ״אף אחד לא יגלול למטה עד הפרויקטים״: a short numbers dashboard on top (tinted), the
// three winners with their pictures, the small tiles of every other project with the filter line stuck
// under the top bar, then the partners, one sentence, the employers' call, the footer. Round 5 (5/11):
// no words on top - the jumping logo and the numbers; no ״איך זה עבד״.
// PUBLIC, not indexed while it is a comparison.
import type { Metadata } from "next";
import { Suspense } from "react";
import { COUNTS, PROJECTS, projectByK8, topTech } from "@/lib/hackathon-showcase";
import { Explorer } from "./explorer";
import { Dashboard, Employers, Footer, Quote, TopBar, WRAP, Winners } from "./ui";

const DESCRIPTION = `${COUNTS.projects} מערכות AI עובדות שבנו ${COUNTS.people} מפתחות מקהילת קוד פתוח בשבוע, לשלושה ארגונים אמיתיים: שטראוס, הפניקס והמעבדה המרכזית לנגיפים. לכל פרויקט - הסרטון, המערכת החיה בענן, הטכנולוגיות ומשפט אישי.`;

export const metadata: Metadata = {
  title: "הפרויקטים של האקתון AI 2026",
  description: DESCRIPTION,
  robots: { index: false, follow: true },
  openGraph: { title: "הפרויקטים של האקתון AI קוד פתוח 2026", description: DESCRIPTION, images: [{ url: "/hackathon-2026/logo-hackathon.png" }] },
};

/** The sentence between the partners and the employers - יפה חבקין's, from the booklet. */
const QUOTE_K8 = "1da3dbcf";

export default function ShowcasePage() {
  return (
    <main className="min-h-full bg-white text-[#1B1530] overflow-x-hidden">
      <TopBar />
      <Dashboard />
      <Winners />
      <Suspense fallback={<div className={`${WRAP} py-16 text-center text-[#6B6580]`}>טוענת את הפרויקטים…</div>}>
        <Explorer projects={PROJECTS} topTech={topTech(14)} />
      </Suspense>
      <Quote p={projectByK8(QUOTE_K8)} />
      <Employers />
      <Footer />
    </main>
  );
}
