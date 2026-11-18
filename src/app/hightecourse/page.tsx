import type { Metadata } from "next";
import { hcSheetUrl, hcSnapshot, sheetErrorText, type Snapshot } from "./data";
import { GateView, hcGate } from "./shell";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: { absolute: "דשבורד | ניהול הייטקורס" } };
export const dynamic = "force-dynamic";

/*
  The dashboard of מערכת ניהול הייטקורס: how many participants in each course
  (the owner, 18/11: ״דשבורד של כמות המשתתפות בכל קורס״), split by registration
  track, with the counts around it - all read from her sheet.
*/
export default async function HcDashboardPage() {
  const { profile, isAdmin } = await hcGate();
  if (!isAdmin) return <GateView profile={profile} />;

  let snap: Snapshot | null = null;
  let error = "";
  try {
    snap = await hcSnapshot();
  } catch (e) {
    error = sheetErrorText(e);
  }
  return <Dashboard snap={snap} error={error} sheetUrl={hcSheetUrl(snap?.participantsGid ?? undefined)} />;
}
