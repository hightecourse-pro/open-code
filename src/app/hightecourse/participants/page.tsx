import type { Metadata } from "next";
import { H } from "../../ai-course/theme";
import { hcSheetUrl, hcSnapshot, sheetErrorText, type Snapshot } from "../data";
import { Freshness } from "../gate";
import { GateView, hcGate } from "../shell";
import { Notice } from "../ui";
import { ParticipantsTable } from "./participants-table";

export const metadata: Metadata = { title: "משתתפות" };
export const dynamic = "force-dynamic";

/*
  The participants of the year as a searchable table - the ״משתתפות״ tab, with
  filters by course, track, company and lodging; a row opens to every filled
  cell of the sheet row. The dashboard's course and company names link here.
*/
export default async function HcParticipantsPage({ searchParams }: { searchParams: Promise<{ course?: string; track?: string; company?: string; q?: string }> }) {
  const { profile, isAdmin } = await hcGate();
  if (!isAdmin) return <GateView profile={profile} />;
  const sp = await searchParams;

  let snap: Snapshot | null = null;
  let error = "";
  try {
    snap = await hcSnapshot();
  } catch (e) {
    error = sheetErrorText(e);
  }
  if (!snap) {
    return (
      <div className="space-y-4">
        <h1 className="text-[22px] font-black" style={{ color: H.navy }}>
          משתתפות
        </h1>
        <Notice tone="error">{error}</Notice>
        <Freshness fetchedAt={new Date().toISOString()} />
      </div>
    );
  }
  return (
    <ParticipantsTable
      rows={snap.participants}
      courses={snap.courses.map((c) => c.course)}
      companies={snap.companies.map((c) => c.company)}
      tracks={snap.tracks}
      fetchedAt={snap.fetchedAt}
      sheetUrl={hcSheetUrl(snap.participantsGid ?? undefined)}
      initial={{ course: sp.course ?? "", track: sp.track ?? "", company: sp.company ?? "", q: sp.q ?? "" }}
    />
  );
}
