import type { Metadata } from "next";
import { ConferenceOrdersScreen } from "@/app/(admin)/admin/hightecourse/screen";
import { GateView, hcGate } from "../shell";

export const metadata: Metadata = { title: { absolute: "רישום ליום חמישי | ניהול הייטקורס" } };
export const dynamic = "force-dynamic";

/**
 * The day-3 registrations (the public /hightecourse-2026 page) inside the
 * system - the same screen as /admin/hightecourse (the owner, 22/11: ״תפתח לה
 * כל מה שקשור להייטקורס״).
 */
export default async function HcDay3Page() {
  const { profile, allowed } = await hcGate();
  if (!allowed) return <GateView profile={profile} />;
  return <ConferenceOrdersScreen />;
}
