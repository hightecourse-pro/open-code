import type { Metadata } from "next";
import { GateView, hcGate } from "@/app/hightecourse/shell";
import { studioView } from "@/lib/sanity/server";
import { Studio } from "./studio";
import "./studio.css";

export const metadata: Metadata = { title: { absolute: "המסע לאי השפיות · הסטודיו" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/*
  הסטודיו - the control room behind the scenes of המסע לאי השפיות: the events
  (a rehearsal, the day), the tablets' addresses, the remote for the hall
  screen, the melody, the song, the shapes and the reveal. The same door as
  the Hightecourse management system: an Open Code admin or an hc_access
  account (the owner, 22/11: ״תפתח לה כל מה שקשור להייטקורס״).
*/
export default async function StudioPage() {
  const { profile, allowed } = await hcGate();
  if (!allowed) {
    return (
      <div dir="rtl" className="min-h-screen bg-white px-4 py-8" data-testid="studio-gate">
        <div className="mx-auto max-w-md text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sanity/logo.png" alt="המסע לאי השפיות" width={120} height={120} className="mx-auto" />
          <h1 className="mt-3 text-[22px] font-black" style={{ color: "#15233F" }}>
            הסטודיו של המסע לאי השפיות
          </h1>
        </div>
        <GateView profile={profile} />
      </div>
    );
  }
  const initial = await studioView();
  return <Studio initial={initial} userName={profile?.first_name || profile?.full_name || ""} />;
}
