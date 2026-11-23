import type { Metadata, Viewport } from "next";
import { buildContent } from "@/lib/sanity/content";
import { SanityError, tabletBootstrap } from "@/lib/sanity/server";
import type { TabletBootstrap } from "@/lib/sanity/shared";
import { Tablet } from "../tablet";
import "../tablet.css";

export const dynamic = "force-dynamic";

/** A game, not a web page: no pinch-zoom, no double-tap zoom, the stage under the notch, the dark bezel colour in the system bars. */
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: "cover", themeColor: "#0B1530" };

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  return {
    title: { absolute: "המסע לאי השפיות · טאבלט" },
    robots: { index: false, follow: false },
    // ״הוספה למסך הבית״ in Chrome installs this circle as its own app (full screen, landscape).
    manifest: `/sanity/t/${token}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "המסע לאי השפיות", statusBarStyle: "black-translucent" },
  };
}

/*
  The tablet of one circle (1280×720, landscape). The token in the address is
  the circle's whole identity: the page reads the circle's saved game from the
  server and hands it to the tablet, which continues from there - on the same
  device after a refresh, or on any other device opening the same address.
*/
export default async function TabletPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let boot: TabletBootstrap | null = null;
  let problem: string | null = null;
  try {
    boot = await tabletBootstrap(token);
  } catch (e) {
    problem = e instanceof SanityError && e.status === 404 ? buildContent("m").UI.sync.badToken : "משהו לא עבד בטעינת הטאבלט. רעננו את הדף.";
  }
  if (!boot) {
    return (
      <div className="hk-tablet hk-page" style={{ display: "grid", placeItems: "center", background: "#0B1530", color: "#fff", padding: 40, textAlign: "center" }} data-testid="tablet-bad-token">
        <div style={{ maxWidth: 640 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sanity/logo.png" alt="" style={{ width: 140, margin: "0 auto 24px" }} />
          <p style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.3, margin: 0 }}>{problem}</p>
        </div>
      </div>
    );
  }
  return <Tablet boot={boot} token={token} />;
}
