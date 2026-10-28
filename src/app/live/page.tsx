import type { Metadata } from "next";
import { Heebo, Karantina } from "next/font/google";
import { getProfile } from "@/lib/auth";
import { displayView } from "@/lib/hackathon-live";
import { LiveDisplay } from "./live-display";

export const metadata: Metadata = { title: "מסך האולם", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// The approved design of the LED screen (phone-system/hackathon-voting, 26/10):
// Heebo for text and numbers, Karantina for the big titles.
const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });
const karantina = Karantina({ subsets: ["hebrew", "latin"], weight: ["400", "700"], variable: "--font-karantina", display: "swap" });

/**
 * מסך האולם (the owner, 26/10): the projector page of the finals evening -
 * the audience's phone votes and the judges' scores, live. Public and
 * read-only; an admin who has this page focused can also drive it with a
 * presenter remote (Page Down / Page Up / Space), like the control panel.
 * A 1920×1080 stage scaled to whatever screen shows it; dark (LED) by default,
 * `?theme=light` or `?light=1` for the light version.
 */
export default async function LivePage({ searchParams }: { searchParams: Promise<{ theme?: string; light?: string }> }) {
  const sp = await searchParams;
  const [profile, initial] = await Promise.all([getProfile(), displayView({ poll: false })]);
  const forced = sp.theme === "dark" ? "dark" : sp.theme === "light" || sp.light !== undefined ? "light" : null;
  return <LiveDisplay initial={initial} isAdmin={profile?.role === "admin"} forcedTheme={forced} fontClass={`${heebo.variable} ${karantina.variable}`} />;
}
