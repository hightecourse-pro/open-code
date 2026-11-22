import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { ConferenceOrdersScreen } from "./screen";

export const metadata: Metadata = { title: "הייטקורס - רישום לכנס" };
export const dynamic = "force-dynamic";

/** The Open Code admin's door to the day-3 registrations; the screen itself is shared with /hightecourse/day3. */
export default async function ConferenceAdminPage() {
  await requireRole("admin");
  return <ConferenceOrdersScreen />;
}
