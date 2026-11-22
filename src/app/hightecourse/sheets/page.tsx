import type { Metadata } from "next";
import Link from "next/link";
import { H } from "../../ai-course/theme";
import { GROUP_LABEL, PATHS, type TabGroup } from "../config";
import { hcSheetUrl, hcTabIndex, sheetErrorText } from "../data";
import { GateView, hcGate } from "../shell";
import { Card, ExtLink, Notice } from "../ui";

export const metadata: Metadata = { title: { absolute: "גליונות | ניהול הייטקורס" } };
export const dynamic = "force-dynamic";

/*
  The tabs of the owner's sheet that the system shows, by group. Which tabs
  appear is decided in config.ts (the owner strikes and adds in words).
*/
export default async function HcSheetsIndexPage() {
  const { profile, isAdmin } = await hcGate();
  if (!isAdmin) return <GateView profile={profile} adminOnly />;

  let index: Awaited<ReturnType<typeof hcTabIndex>> = [];
  let error = "";
  try {
    index = await hcTabIndex();
  } catch (e) {
    error = sheetErrorText(e);
  }
  const groups = (Object.keys(GROUP_LABEL) as TabGroup[]).map((g) => ({ g, items: index.filter((x) => x.tab.group === g) }));

  return (
    <div className="space-y-5" data-testid="hc-sheets">
      <div>
        <h1 className="text-[24px] font-black leading-tight" style={{ color: H.navy }}>
          גליונות
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: H.muted }}>
          כל גליון נקרא מהגיליון כמו שהוא · <ExtLink href={hcSheetUrl()}>לפתיחה בגוגל שיטס</ExtLink>
        </p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {groups.map(
        ({ g, items }) =>
          items.length > 0 && (
            <Card key={g} className="px-5 py-4">
              <h2 className="mb-3 text-[16px] font-black" style={{ color: H.navy }}>
                {GROUP_LABEL[g]}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ tab, meta }) => (
                  <li key={tab.slug}>
                    <Link href={tab.slug === "participants" ? PATHS.participants : PATHS.sheet(tab.slug)} className="block h-full px-4 py-3" style={{ border: `1px solid ${H.line}`, borderRadius: 12, color: H.ink, background: H.white }} data-testid="hc-tab-link">
                      <span className="block text-[15px] font-black" style={{ color: H.navy }}>
                        {tab.title}
                      </span>
                      <span className="mt-0.5 block text-[12.5px]" style={{ color: meta || error ? H.muted : H.red }}>
                        {meta || error ? (tab.note ?? " ") : "לא נמצא בגיליון"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )
      )}
    </div>
  );
}
