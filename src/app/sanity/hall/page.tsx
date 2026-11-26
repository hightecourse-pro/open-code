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
 * rehearsal). `?wide=1|0` forces the 4:1 (8 m × 2 m LED wall) or the 16:9
 * stage - otherwise the screen's shape decides; `?stretch=1` squashes the wide
 * stage into a 16:9 signal that the wall's processor stretches back. `?show=1`
 * opens with the start button of the show (the whole ending as one screen).
 */
export default async function HallPage({ searchParams }: { searchParams: Promise<{ event?: string; scene?: string; wide?: string; stretch?: string; show?: string }> }) {
  const sp = await searchParams;
  const slug = sp.event?.trim() || null;
  const scene = sp.scene && (HALL_SCENES as readonly string[]).includes(sp.scene) && sp.scene !== "auto" ? sp.scene : null;
  const forcedWide = sp.wide === "1" ? true : sp.wide === "0" ? false : null;
  const stretch = sp.stretch === "1";
  const show = sp.show === "1";
  const initial = await hallView(slug);
  return <Hall initial={initial} slug={slug} lockedScene={scene} forcedWide={forcedWide} stretch={stretch} show={show} />;
}
