import type { Metadata } from "next";
import { dashRowsOf, hcSheetUrl, hcSnapshot, sheetErrorText, type Snapshot } from "./data";
import { GateView, hcGate } from "./shell";
import { Dashboard, type DashboardData } from "./dashboard";

export const metadata: Metadata = { title: { absolute: "דשבורד | ניהול הייטקורס" } };
export const dynamic = "force-dynamic";

/*
  The dashboard of מערכת ניהול הייטקורס (the owner, 18/11): participants per
  course - the frontal and the digital lists apart - lodging and every paid
  item with ״chosen but not recorded as paid״ marked, and the companies split
  frontal/digital. Every number opens the names behind it; the browser gets
  the slim rows and counts everything itself.
*/
export default async function HcDashboardPage() {
  const { profile, allowed } = await hcGate();
  if (!allowed) return <GateView profile={profile} />;

  let snap: Snapshot | null = null;
  let error = "";
  try {
    snap = await hcSnapshot();
  } catch (e) {
    error = sheetErrorText(e);
  }
  const data: DashboardData | null = snap
    ? {
        sheetTitle: snap.sheetTitle,
        fetchedAt: snap.fetchedAt,
        rows: dashRowsOf(snap.participants),
        categoryByCourse: snap.categoryByCourse,
        extras: snap.extras,
        missingTabs: snap.missingTabs,
      }
    : null;
  return <Dashboard data={data} error={error} sheetUrl={hcSheetUrl(snap?.participantsGid ?? undefined)} />;
}
