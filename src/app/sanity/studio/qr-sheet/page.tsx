import type { Metadata } from "next";
import { GateView, hcGate } from "@/app/hightecourse/shell";
import { studioView } from "@/lib/sanity/server";
import { shortPath } from "@/lib/sanity/shared";
import { QrSheet } from "./sheet";
import "./qr-sheet.css";

export const metadata: Metadata = { title: { absolute: "המסע לאי השפיות · גיליון QR לטאבלטים" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/*
  The printable sheet of every tablet's address as a QR card (the owner, 25.11: ״תכין לי בניהול גם אופציה להוריד
  PDF של כל הטאבלטים״): six cards per A4 page, cut out, one per circle, stuck on the back of its tablet. Opened from
  the studio with ?print=1 the browser's print dialog comes up by itself - ״שמירה כ-PDF״ is the download. Same door
  as the studio.
*/
export default async function QrSheetPage({ searchParams }: { searchParams: Promise<{ print?: string }> }) {
  const { profile, allowed } = await hcGate();
  if (!allowed) {
    return (
      <div dir="rtl" className="min-h-screen bg-white px-4 py-8" data-testid="qr-sheet-gate">
        <GateView profile={profile} />
      </div>
    );
  }
  const view = await studioView();
  const active = view.events.find((e) => e.slug === view.active) ?? null;
  const sp = await searchParams;
  // the short address (26.11, ״לא בכל טאבלט QR״): typed into Chrome where there is no scanner, and the same thing the code carries
  const cards = view.tokens.map((t) => ({ circle: t.circle, path: shortPath(t.circle) }));
  return <QrSheet eventName={active?.name ?? ""} cards={cards} autoprint={sp.print === "1"} />;
}
