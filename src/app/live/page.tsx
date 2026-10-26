import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { displayView } from "@/lib/hackathon-live";
import { LiveDisplay } from "./live-display";

export const metadata: Metadata = { title: "מסך האולם", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * מסך האולם (the owner, 26/10): the projector page of the finals evening -
 * the audience's phone votes and the judges' scores, live. Public and
 * read-only; an admin who has this page focused can also drive it with a
 * presenter remote (Page Down / Page Up / Space), like the control panel.
 */
export default async function LivePage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const sp = await searchParams;
  const [profile, initial] = await Promise.all([getProfile(), displayView({ poll: false })]);
  const forced = sp.theme === "dark" ? "dark" : sp.theme === "light" ? "light" : null;
  return <LiveDisplay initial={initial} isAdmin={profile?.role === "admin"} forcedTheme={forced} />;
}
