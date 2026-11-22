import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { H } from "../../../ai-course/theme";
import { PATHS, tabBySlug } from "../../config";
import { hcSheetUrl, hcTable, hcTabsMeta, sheetErrorText, type SheetTable as SheetTableData } from "../../data";
import { Freshness } from "../../gate";
import { GateView, hcGate } from "../../shell";
import { Notice } from "../../ui";
import { SheetTable } from "./sheet-table";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tab = tabBySlug((await params).slug);
  return { title: { absolute: `${tab?.title ?? "גליון"} | ניהול הייטקורס` } };
}

/** One tab of the sheet as a searchable table - exactly the sheet's columns, minus the ones that must never render. */
export default async function HcSheetPage({ params }: { params: Promise<{ slug: string }> }) {
  const tab = tabBySlug((await params).slug);
  if (!tab) notFound();
  if (tab.slug === "participants") redirect(PATHS.participants);

  const { profile, isAdmin } = await hcGate();
  if (!isAdmin) return <GateView profile={profile} adminOnly />;

  let table: SheetTableData | null = null;
  let gid: number | undefined;
  let error = "";
  try {
    const [t, meta] = await Promise.all([hcTable(tab), hcTabsMeta()]);
    table = t;
    gid = meta.tabs.find((x) => x.title === tab.title)?.gid;
    if (gid == null) error = `הגליון ״${tab.title}״ לא נמצא בגיליון - אולי שונה לו השם.`;
  } catch (e) {
    error = sheetErrorText(e);
  }
  if (!table || error) {
    return (
      <div className="space-y-4">
        <h1 className="text-[22px] font-black" style={{ color: H.navy }}>
          {tab.title}
        </h1>
        <Notice tone="error">{error}</Notice>
        <Freshness fetchedAt={new Date().toISOString()} />
      </div>
    );
  }
  return <SheetTable title={tab.title} note={tab.note} header={table.header} rows={table.rows} fetchedAt={table.fetchedAt} sheetUrl={hcSheetUrl(gid)} />;
}
