import type { Metadata } from "next";
import { hallView } from "@/lib/sanity/server";
import { HALL_SCENES } from "@/lib/sanity/shared";
import { Hall } from "./hall";

export const metadata: Metadata = { title: { absolute: "המסע לאי השפיות · מסך האולם" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * מסך האולם: the projector's page. Public and read-only - it shows the active
 * event (or `?event=<slug>`), and the studio drives its scenes and the reveal.
 * `?scene=map|focus|compare|race|stats|grand` locks one scene (for a check, a
 * rehearsal).
 */
export default async function HallPage({ searchParams }: { searchParams: Promise<{ event?: string; scene?: string }> }) {
  const sp = await searchParams;
  const slug = sp.event?.trim() || null;
  const scene = sp.scene && (HALL_SCENES as readonly string[]).includes(sp.scene) && sp.scene !== "auto" ? sp.scene : null;
  const initial = await hallView(slug);
  return <Hall initial={initial} slug={slug} lockedScene={scene} />;
}
